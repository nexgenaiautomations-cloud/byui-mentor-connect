import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminScope } from "@/lib/admin-scope-server";
import { saveStewardship } from "@/lib/stewardship-server";

const bodySchema = z.object({
  assignments: z.record(z.string().min(1), z.string().min(1).nullable()),
});

// PUT /api/admin/stewardship { assignments: { mentorId: executiveId | null } }
// Saves the admin-approved stewardship board.
export async function PUT(req: Request) {
  const auth = await requireAdminScope(req);
  if (auth instanceof Response) return auth;
  const { admin, scope } = auth;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await saveStewardship(admin.id, parsed.data.assignments, req, scope);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}
