// Executive summary + ROI model — pure. Every estimate is labelled as such
// and carries the assumption that produced it (spec §8–9).
import { isMeeting, isInteraction } from "@/lib/engagement";
import { countOffers } from "@/lib/career";
import {
  firstMeetingOverall,
  healthCounts,
  pledgeOnTrack,
  retentionOverall,
  type LogRow,
  type MatchRow,
  type Rate,
  type StudentRow,
} from "@/lib/effectiveness";
import type { ExistingMilestone } from "@/lib/career";
import type { RoiAssumptions, Thresholds } from "@/lib/program-settings";
import { csvCell } from "@/lib/reports";

export type ExecutiveSummary = {
  participatingStudents: number;
  activeRelationships: number;
  firstMeeting30: Rate;
  retention30: Rate;
  meetingsInPeriod: number;
  studentsNeedingIntervention: number;
  studentsOnTrack: Rate;
  internshipsReported: number;
  placementsReported: number; // part-time + full-time offers
  acceptedOrStarted: number;
  health: Record<"healthy" | "needs_attention" | "inactive", number>;
};

export function executiveSummary(input: {
  students: StudentRow[];
  matches: MatchRow[];
  logs: LogRow[];
  milestones: ExistingMilestone[];
  openInterventionStudents: Set<string>;
  range: { start: Date; end: Date };
  now: Date;
  thresholds: Thresholds;
}): ExecutiveSummary {
  const { students, matches, logs, milestones, range, now } = input;
  const ids = new Set(students.map((s) => s.id));
  const inRange = (d: Date) => d >= range.start && d < range.end;
  const offers = countOffers(milestones.filter((m) => inRange(m.occurredOn)));
  const onTrack = pledgeOnTrack(students, logs, now);
  return {
    participatingStudents: students.length,
    activeRelationships: matches.filter((m) => m.status === "active").length,
    firstMeeting30: firstMeetingOverall(matches, now, 30),
    retention30: retentionOverall(matches, logs, now, 30),
    meetingsInPeriod: logs.filter((l) => isMeeting(l.eventKind) && inRange(l.meetingDate)).length,
    studentsNeedingIntervention: [...input.openInterventionStudents].filter((id) => ids.has(id)).length,
    studentsOnTrack: {
      num: onTrack.size,
      den: students.length,
      pct: students.length >= 5 ? Math.round((onTrack.size / students.length) * 1000) / 10 : null,
    },
    internshipsReported: offers.internship,
    placementsReported: offers.part_time + offers.full_time,
    acceptedOrStarted: new Set(
      milestones.filter((m) => (m.stage === "offer_accepted" || m.stage === "started") && inRange(m.occurredOn)).map((m) => m.studentId)
    ).size,
    health: healthCounts(matches, now, input.thresholds),
  };
}

// ---- ROI ----

export type RoiTracked = {
  // Mentor-meeting + touchpoint minutes that were actually logged.
  loggedMinutes: number;
  interactionsLogged: number;
  interactionsWithoutDuration: number;
  remindersDelivered: number; // meeting + inactivity reminders, status sent
  followUpsDelivered: number; // log/confirm/action-item follow-ups, status sent
  followUpTasksCompleted: number; // action items marked done
  interventionsRecorded: number; // outreach actions on cases
  casesResolved: number;
};

export type RoiResult = {
  tracked: RoiTracked & { mentorshipHours: number };
  modeled: {
    staffMinutesSaved: number;
    staffHoursSaved: number;
    staffCostSaved: number;
    interventionStaffHours: number;
    interventionStaffCost: number;
    mentorshipValue: number | null;
  };
  assumptions: RoiAssumptions;
  formulas: string[];
};

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function computeRoi(t: RoiTracked, a: RoiAssumptions): RoiResult {
  const staffMinutesSaved = t.remindersDelivered * a.minutesPerReminder + t.followUpsDelivered * a.minutesPerFollowUp;
  const staffHoursSaved = staffMinutesSaved / 60;
  const interventionStaffHours = (t.interventionsRecorded * a.minutesPerIntervention) / 60;
  const mentorshipHours = t.loggedMinutes / 60;
  return {
    tracked: { ...t, mentorshipHours: round(mentorshipHours) },
    modeled: {
      staffMinutesSaved: Math.round(staffMinutesSaved),
      staffHoursSaved: round(staffHoursSaved),
      staffCostSaved: Math.round(staffHoursSaved * a.staffHourlyCost),
      interventionStaffHours: round(interventionStaffHours),
      interventionStaffCost: Math.round(interventionStaffHours * a.staffHourlyCost),
      mentorshipValue: a.mentorHourValue > 0 ? Math.round(mentorshipHours * a.mentorHourValue) : null,
    },
    assumptions: a,
    formulas: [
      `Staff time saved = ${t.remindersDelivered} reminders × ${a.minutesPerReminder} min + ${t.followUpsDelivered} follow-ups × ${a.minutesPerFollowUp} min`,
      `Staff cost saved = staff hours saved × $${a.staffHourlyCost}/hour`,
      `Intervention staff time = ${t.interventionsRecorded} outreach actions × ${a.minutesPerIntervention} min`,
      a.mentorHourValue > 0
        ? `Mentorship value = ${round(mentorshipHours)} logged hours × $${a.mentorHourValue}/hour`
        : "Mentorship value not shown (no dollar value per mentor hour set)",
    ],
  };
}

// Sum of logged minutes for interactions only; counts how many lacked a
// duration so the figure is clearly a floor.
export function trackedMentorship(logs: LogRow[], range: { start: Date; end: Date }) {
  let minutes = 0;
  let count = 0;
  let missing = 0;
  for (const l of logs) {
    if (!isInteraction(l.eventKind) || l.meetingDate < range.start || l.meetingDate >= range.end) continue;
    count++;
    if (l.durationMinutes) minutes += l.durationMinutes;
    else missing++;
  }
  return { loggedMinutes: minutes, interactionsLogged: count, interactionsWithoutDuration: missing };
}

export const REMINDER_KINDS = ["meeting_24h", "meeting_1h", "inactivity_first_meeting", "inactivity_checkin", "inactivity_concern"];
export const FOLLOW_UP_KINDS = ["log_followup", "confirm_meeting", "action_items"];

// ---- CSV ----

export function toMetricCsv(title: string, rows: [string, string | number | null, string?][]): string {
  const lines = [["Metric", "Value", "Notes"].join(","), ...rows.map((r) => [r[0], r[1], r[2] ?? ""].map(csvCell).join(","))];
  return `${csvCell(title)}\n${lines.join("\n")}\n`;
}

export function pct(r: Rate): string {
  return r.pct === null ? `insufficient data (n=${r.den})` : `${r.pct}% (${r.num}/${r.den})`;
}

