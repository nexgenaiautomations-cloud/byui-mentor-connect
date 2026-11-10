import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { saveStewardship } from "@/lib/stewardship-server";

const bodySchema = z.object({
  assignments: z.record(z.string().min(1), z.string().min(1).nullable()),
});

// PUT /api/admin/stewardship { assignments: { mentorId: executiveId | null } }
// Saves the admin-approved stewardship board.
export async function PUT(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await saveStewardship(admin.id, parsed.data.assignments, req);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}
