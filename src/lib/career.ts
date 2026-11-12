// Career pipeline — pure helpers (docs/specs/accountability-upgrade.md §4).
//
// Milestones are events. A student's *current* stage is their most recent
// report; the funnel counts the unique students who ever reached a stage.
// Offers are counted once: an acceptance that points at an offer milestone
// (relatedMilestoneId) is not a second offer.
import { keyForLabel } from "@/lib/possible-actions";

export const CAREER_STAGES = [
  "exploring",
  "preparing",
  "applying",
  "interviewing",
  "offer_received",
  "offer_accepted",
  "started",
] as const;
export type CareerStage = (typeof CAREER_STAGES)[number];

export const STAGE_LABEL: Record<CareerStage, string> = {
  exploring: "Exploring careers",
  preparing: "Preparing applications",
  applying: "Actively applying",
  interviewing: "Interviewing",
  offer_received: "Offer received",
  offer_accepted: "Offer accepted",
  started: "Started internship / job",
};

export const OPPORTUNITY_TYPES = ["internship", "part_time", "full_time"] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_LABEL: Record<OpportunityType, string> = {
  internship: "Internship",
  part_time: "Part-time job",
  full_time: "Full-time job",
};

// Stages from offer_received on describe a specific opportunity, so the
// opportunity type is required there.
export function stageNeedsOpportunity(stage: CareerStage): boolean {
  return stage === "offer_received" || stage === "offer_accepted" || stage === "started";
}

export function stageIndex(stage: CareerStage): number {
  return CAREER_STAGES.indexOf(stage);
}

export function isCareerStage(v: unknown): v is CareerStage {
  return typeof v === "string" && (CAREER_STAGES as readonly string[]).includes(v);
}

export function isOpportunityType(v: unknown): v is OpportunityType {
  return typeof v === "string" && (OPPORTUNITY_TYPES as readonly string[]).includes(v);
}

// ---- Offer accomplishments on activity logs ----

const OFFER_KEY_TO_TYPE: Record<string, OpportunityType> = {
  internship_offer: "internship",
  part_time_offer: "part_time",
  full_time_offer: "full_time",
};

// Which offers does an activity log's topics string report? Each type at
// most once per log, so one log can never count the same offer twice.
export function offersInTopics(topics: string | null | undefined): OpportunityType[] {
  const out = new Set<OpportunityType>();
  for (const part of (topics ?? "").split(" · ")) {
    const key = keyForLabel(part.trim());
    if (key && OFFER_KEY_TO_TYPE[key]) out.add(OFFER_KEY_TO_TYPE[key]);
  }
  return OPPORTUNITY_TYPES.filter((t) => out.has(t));
}

// ---- Validation of a new self-reported milestone ----

export type MilestoneInput = {
  stage: CareerStage;
  opportunityType: OpportunityType | null;
  relatedMilestoneId: string | null;
};

export type ExistingMilestone = {
  id: string;
  studentId: string;
  stage: CareerStage | string;
  opportunityType: string | null;
  relatedMilestoneId?: string | null;
  occurredOn: Date;
  createdAt?: Date;
  verification?: string;
};

// Returns an error message, or null when the milestone is acceptable.
export function validateMilestone(
  input: MilestoneInput,
  own: ExistingMilestone[]
): string | null {
  if (stageNeedsOpportunity(input.stage) && !input.opportunityType) {
    return "Choose whether this is an internship, part-time or full-time role.";
  }
  if (input.relatedMilestoneId) {
    const related = own.find((m) => m.id === input.relatedMilestoneId);
    if (!related) return "That offer was not found on your record.";
    if (input.stage !== "offer_accepted" && input.stage !== "started") {
      return "Only an acceptance or start date can be linked to an offer.";
    }
    if (related.stage !== "offer_received" && related.stage !== "offer_accepted") {
      return "You can only link to an offer.";
    }
    if (input.stage === "offer_accepted") {
      const already = own.some(
        (m) => m.stage === "offer_accepted" && m.relatedMilestoneId === input.relatedMilestoneId
      );
      if (already) return "You already accepted that offer.";
    }
  }
  return null;
}

// ---- Derived student view ----

export function currentStage(milestones: ExistingMilestone[]): CareerStage | null {
  let best: ExistingMilestone | null = null;
  for (const m of milestones) {
    if (!isCareerStage(m.stage)) continue;
    if (
      !best ||
      m.occurredOn > best.occurredOn ||
      (m.occurredOn.getTime() === best.occurredOn.getTime() &&
        stageIndex(m.stage as CareerStage) > stageIndex(best.stage as CareerStage))
    ) {
      best = m;
    }
  }
  return best ? (best.stage as CareerStage) : null;
}

export const NEXT_ACTION: Record<CareerStage | "none", string> = {
  none: "Tell us where you are in your career search — it takes ten seconds.",
  exploring: "Book a career chat with someone in a field you are curious about.",
  preparing: "Ask your mentor to review your resume before you start applying.",
  applying: "Aim for a few quality applications this week, then practice interviewing.",
  interviewing: "Role-play your next interview with your mentor.",
  offer_received: "Talk the offer through with your mentor, then record your decision.",
  offer_accepted: "Record your start date once you begin.",
  started: "Congratulations! Share what helped you with newer students.",
};

// ---- Aggregation ----

// Offers counted once each: every offer_received milestone, plus any
// acceptance/start that does NOT point at an existing offer (an offer the
// student reported only at acceptance time).
export function countOffers(milestones: ExistingMilestone[]): Record<OpportunityType, number> {
  const out: Record<OpportunityType, number> = { internship: 0, part_time: 0, full_time: 0 };
  const ids = new Set(milestones.map((m) => m.id));
  // An unlinked acceptance and its later unlinked start are the same offer;
  // count implied offers once per (student, type).
  const implied = new Set<string>();
  for (const m of milestones) {
    if (!isOpportunityType(m.opportunityType)) continue;
    if (m.stage === "offer_received") {
      out[m.opportunityType] += 1;
    } else if (
      (m.stage === "offer_accepted" || m.stage === "started") &&
      !(m.relatedMilestoneId && ids.has(m.relatedMilestoneId))
    ) {
      const k = `${m.studentId}|${m.opportunityType}`;
      if (!implied.has(k)) {
        implied.add(k);
        out[m.opportunityType] += 1;
      }
    }
  }
  return out;
}

// Unique students who ever reached each stage. Reaching a later stage
// implies the earlier ones from `applying` onward (you can't interview
// without applying), but exploring/preparing are only counted when reported.
export function funnelUniqueStudents(
  milestones: ExistingMilestone[],
  extraApplying: Iterable<string> = []
): Record<CareerStage, number> {
  const reached = new Map<CareerStage, Set<string>>();
  for (const s of CAREER_STAGES) reached.set(s, new Set());
  const add = (stage: CareerStage, student: string) => reached.get(stage)!.add(student);
  for (const m of milestones) {
    if (!isCareerStage(m.stage)) continue;
    add(m.stage, m.studentId);
    const idx = stageIndex(m.stage);
    for (const s of CAREER_STAGES) {
      const i = stageIndex(s);
      if (i >= stageIndex("applying") && i < idx) {
        // interviewing does not imply an offer etc.; only fill backwards
        add(s, m.studentId);
      }
    }
  }
  for (const s of extraApplying) add("applying", s);
  const out = {} as Record<CareerStage, number>;
  for (const s of CAREER_STAGES) out[s] = reached.get(s)!.size;
  return out;
}

export function studentsByCurrentStage(
  milestones: ExistingMilestone[]
): Record<CareerStage, number> {
  const byStudent = new Map<string, ExistingMilestone[]>();
  for (const m of milestones) {
    const list = byStudent.get(m.studentId) ?? [];
    list.push(m);
    byStudent.set(m.studentId, list);
  }
  const out = {} as Record<CareerStage, number>;
  for (const s of CAREER_STAGES) out[s] = 0;
  for (const list of byStudent.values()) {
    const s = currentStage(list);
    if (s) out[s] += 1;
  }
  return out;
}
