import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { MANAGED_ROLES } from "@/lib/user-admin";
import { changeRole, removeUser, restoreUser } from "@/lib/user-admin-server";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_role"), role: z.enum(MANAGED_ROLES) }),
  z.object({ action: z.literal("remove"), reason: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("restore") }),
]);

// POST /api/admin/users/:id — change a member's role, remove them from ICAN
// (deactivate), or restore a removed account. Permission rules live in
// src/lib/user-admin.ts.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;
  const result =
    body.action === "set_role"
      ? await changeRole(admin, id, body.role, req)
      : body.action === "remove"
        ? await removeUser(admin, id, body.reason || null, req)
        : await restoreUser(admin, id, req);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
