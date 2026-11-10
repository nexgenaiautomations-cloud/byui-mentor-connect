import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { acknowledgeIssue } from "@/lib/issues-server";

const bodySchema = z.object({
  action: z.enum(["seen", "addressed"]),
  note: z.string().trim().max(2000).optional(),
});

// POST /api/admin/issues/:id  { action: "seen" | "addressed", note? }
// Records this admin's acknowledgement; "addressed" also closes the issue.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await acknowledgeIssue(
    id,
    admin,
    parsed.data.action,
    parsed.data.note || null,
    req
  );
  if (result === "not_found") {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
