import { requireAdmin } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import {
  interventionOutcomes,
  loadProgramData,
  loadRoiTracked,
  openInterventionStudents,
  parseProgramFilters,
} from "@/lib/effectiveness-server";
import { getRoiAssumptions, getThresholds } from "@/lib/program-settings-server";
import { applicationLogCounts } from "@/lib/career-server";
import { resolveRange } from "@/lib/reports";
import { computeRoi, executiveSummary, pct, toMetricCsv } from "@/lib/program-report";
import {
  FIRST_MEETING_WINDOWS,
  RETENTION_POINTS,
  firstMeetingByCohort,
  lastMonthKeys,
  meetingConsistency,
  outcomesByEngagement,
  pledgeByGroup,
  retentionByCohort,
} from "@/lib/effectiveness";
import { CAREER_STAGES, STAGE_LABEL, funnelUniqueStudents } from "@/lib/career";

// GET /api/admin/program-report/csv?report=executive|effectiveness|roi&...
// Aggregates only — no student names or emails in these exports.
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const report = ["executive", "effectiveness", "roi"].includes(params.report) ? params.report : "executive";
  const filters = parseProgramFilters(params);
  const scope = adminScopeFor(admin, filters.school)!;
  const range = resolveRange({ preset: params.range ?? "last_90" });
  const now = new Date();
  const data = await loadProgramData(scope, filters);
  const header = `ICAN ${report} report — ${scope.school ?? "all schools"} — ${range.from} to ${range.to}`;
  const filterNote: [string, string][] = Object.entries(filters)
    // The school actually applied is in the header; never echo a requested
    // school that wasn't honoured.
    .filter(([k, v]) => v && k !== "school")
    .map(([k, v]) => [`Filter: ${k}`, v]);

  let csv: string;
  if (report === "roi") {
    const roi = computeRoi(await loadRoiTracked(scope, data, range), await getRoiAssumptions(scope.school));
    csv = toMetricCsv(header, [
      ...filterNote,
      ["TRACKED — mentorship hours logged", roi.tracked.mentorshipHours, `${roi.tracked.interactionsWithoutDuration} interactions had no duration`],
      ["TRACKED — reminders delivered", roi.tracked.remindersDelivered],
      ["TRACKED — follow-ups delivered", roi.tracked.followUpsDelivered],
      ["TRACKED — follow-up tasks completed", roi.tracked.followUpTasksCompleted],
      ["TRACKED — intervention outreach recorded", roi.tracked.interventionsRecorded],
      ["TRACKED — intervention cases resolved", roi.tracked.casesResolved],
      ["ESTIMATE — staff hours saved", roi.modeled.staffHoursSaved, roi.formulas[0]],
      ["ESTIMATE — staff cost saved (USD)", roi.modeled.staffCostSaved, roi.formulas[1]],
      ["ESTIMATE — intervention staff hours", roi.modeled.interventionStaffHours, roi.formulas[2]],
      ["ESTIMATE — mentorship value (USD)", roi.modeled.mentorshipValue, roi.formulas[3]],
      ...Object.entries(roi.assumptions).map(([k, v]) => [`ASSUMPTION — ${k}`, v] as [string, number]),
      ["Note", "Estimates are modeled from the assumptions above; they are not audited financial results."],
    ]);
  } else {
    const [thresholds, openStudents, outcomes, appCounts] = await Promise.all([
      getThresholds(scope.school),
      openInterventionStudents(scope),
      interventionOutcomes(scope, range),
      applicationLogCounts(data.students.map((s) => s.id)),
    ]);
    const s = executiveSummary({ ...data, openInterventionStudents: openStudents, range, now, thresholds });
    const rows: [string, string | number | null, string?][] = [
      ...filterNote,
      ["Participating students", s.participatingStudents],
      ["Active mentorships", s.activeRelationships],
      ["Healthy / needs attention / inactive pairs", `${s.health.healthy} / ${s.health.needs_attention} / ${s.health.inactive}`],
      ["First meeting within 30 days", pct(s.firstMeeting30)],
      ["30-day retention", pct(s.retention30), "Interaction in the first 30 days"],
      ["Mentor meetings in period", s.meetingsInPeriod, "Independent activity excluded"],
      ["Students with an open intervention", s.studentsNeedingIntervention],
      ["Intervention cases opened in period", outcomes.opened],
      ["On track with 3-2-1", pct(s.studentsOnTrack)],
      ["Internship offers reported in period", s.internshipsReported, "Self-reported unless verified"],
      ["Part/full-time offers reported in period", s.placementsReported],
      ["Students accepting or starting in period", s.acceptedOrStarted],
    ];
    const funnel = funnelUniqueStudents(
      data.milestones.filter((m) => m.occurredOn >= range.start && m.occurredOn < range.end),
      [...appCounts.keys()]
    );
    for (const st of CAREER_STAGES) rows.push([`Funnel (unique students) — ${STAGE_LABEL[st]}`, funnel[st]]);
    if (report === "effectiveness") {
      const cohorts = lastMonthKeys(now, 6);
      for (const c of firstMeetingByCohort(data.matches, now, cohorts)) {
        for (const w of FIRST_MEETING_WINDOWS) rows.push([`First meeting ≤${w}d — matched ${c.cohort}`, pct(c.windows[w])]);
      }
      for (const c of retentionByCohort(data.matches, data.logs, now, cohorts)) {
        for (const p of RETENTION_POINTS) rows.push([`Retention day ${p} — matched ${c.cohort}`, pct(c.points[p])]);
      }
      const cons = meetingConsistency(data.matches, data.logs, now, thresholds.expectedMeetingIntervalDays);
      rows.push(["Meetings per student", cons.meetingsPerStudent], ["Avg days between meetings", cons.avgDaysBetweenMeetings], ["Pairs on cadence", pct(cons.onCadence)], ["Active pairs with no meeting", pct(cons.noMeetingYet)]);
      for (const g of pledgeByGroup(data.students, data.logs, data.milestones, now, (x) => x.department)) {
        rows.push([`3-2-1 on track — ${g.group}`, g.suppressed ? "hidden (fewer than 5 students)" : pct(g.onTrack!)]);
      }
      const o = outcomesByEngagement(data.students, data.matches, data.logs, data.milestones);
      rows.push(
        ["Offer rate — engaged students", o.engaged.suppressed ? "hidden" : pct(o.engaged.withOffer!), "Descriptive association, not causation"],
        ["Offer rate — matched, less engaged", o.lessEngaged.suppressed ? "hidden" : pct(o.lessEngaged.withOffer!)],
        ["Offer rate — not matched", o.unmatched.suppressed ? "hidden" : pct(o.unmatched.withOffer!)]
      );
    }
    csv = toMetricCsv(header, rows);
  }

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ican-${report}-${range.from}-to-${range.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
