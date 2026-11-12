import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import { auditEvent } from "@/lib/audit";
import { roiSchema, SETTING_KEYS, thresholdOrderError, thresholdsSchema } from "@/lib/program-settings";
import { saveSetting } from "@/lib/program-settings-server";

const body = z.discriminatedUnion("key", [
  z.object({ key: z.literal("thresholds"), value: thresholdsSchema, school: z.string().optional() }),
  z.object({ key: z.literal("roi"), value: roiSchema, school: z.string().optional() }),
]);

// Save per-school program settings. A program admin always writes their own
// school; a platform admin may write a named school or the "*" default.
export async function PUT(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const scope = adminScopeFor(admin, parsed.data.school)!;
  const school = scope.platform ? scope.school ?? "*" : scope.school!;
  if (parsed.data.key === "thresholds") {
    const problem = thresholdOrderError(parsed.data.value);
    if (problem) return NextResponse.json({ error: { formErrors: [problem] } }, { status: 400 });
  }
  await saveSetting(school, SETTING_KEYS[parsed.data.key], parsed.data.value, admin.id);
  void auditEvent({
    actorUserId: admin.id,
    eventType: "ADMIN_UPDATED_PROGRAM_SETTINGS",
    request: req,
    metadata: { key: parsed.data.key, school },
  });
  return NextResponse.json({ ok: true, school });
}
