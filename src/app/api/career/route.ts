import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { careerMilestones } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import {
  CAREER_STAGES,
  OPPORTUNITY_TYPES,
  stageNeedsOpportunity,
  validateMilestone,
  type CareerStage,
  type ExistingMilestone,
} from "@/lib/career";
import { listMilestones } from "@/lib/career-server";

// Only career facts — no salary, financial or other sensitive fields.
const schema = z.object({
  stage: z.enum(CAREER_STAGES),
  opportunityType: z.enum(OPPORTUNITY_TYPES).optional().nullable(),
  careerField: z.string().trim().max(120).optional().nullable(),
  employer: z.string().trim().max(120).optional().nullable(),
  positionTitle: z.string().trim().max(120).optional().nullable(),
  occurredOn: z.coerce.date().optional().nullable(),
  relatedMilestoneId: z.string().uuid().optional().nullable(),
});

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ milestones: await listMilestones(me.id) });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const occurredOn = d.occurredOn ?? new Date();
  if (occurredOn.getTime() > Date.now() + 366 * 86400000) {
    return NextResponse.json({ error: { formErrors: ["That date is too far in the future."] } }, { status: 400 });
  }

  const own = (await listMilestones(me.id)) as ExistingMilestone[];
  const stage = d.stage as CareerStage;
  // An acceptance/start linked to an offer inherits the offer's type.
  const related = d.relatedMilestoneId ? own.find((m) => m.id === d.relatedMilestoneId) : undefined;
  const opportunityType = d.opportunityType ?? (related?.opportunityType as typeof d.opportunityType) ?? null;
  const problem = validateMilestone(
    { stage, opportunityType, relatedMilestoneId: d.relatedMilestoneId ?? null },
    own
  );
  if (problem) return NextResponse.json({ error: { formErrors: [problem] } }, { status: 400 });

  const [row] = await db
    .insert(careerMilestones)
    .values({
      studentId: me.id,
      stage,
      opportunityType: stageNeedsOpportunity(stage) || opportunityType ? opportunityType : null,
      careerField: d.careerField || null,
      employer: d.employer || null,
      positionTitle: d.positionTitle || null,
      occurredOn,
      source: "self_reported",
      relatedMilestoneId: d.relatedMilestoneId ?? null,
    })
    .returning();
  return NextResponse.json({ milestone: row }, { status: 201 });
}
