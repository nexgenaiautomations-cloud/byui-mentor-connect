import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import {
  demoteFromAdmin,
  promoteToAdmin,
  transferHeadAdminTo,
} from "@/lib/head-admin";
import { auditEvent } from "@/lib/audit";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("promote"),
    // Either an existing userId or an email — both supported.
    userId: z.string().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
  }),
  z.object({
    action: z.literal("demote"),
    userId: z.string().min(1),
  }),
  z.object({
    action: z.literal("transfer_head"),
    userId: z.string().min(1),
  }),
]);

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.isHeadAdmin) {
    await auditEvent({
      actorUserId: me.id,
      eventType: "UNAUTHORIZED_ADMIN_ATTEMPT",
      severity: "critical",
      request: req,
      metadata: { route: "admin/admins", reason: "non_head_admin" },
    });
    return NextResponse.json(
      { error: "Only the head admin can manage admins." },
      { status: 403 }
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = raw ? bodySchema.safeParse(raw) : null;
  if (!parsed || !parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "promote") {
      if (!parsed.data.userId && !parsed.data.email) {
        return NextResponse.json(
          { error: "Provide an email or user id." },
          { status: 400 }
        );
      }
      const r = await promoteToAdmin({
        id: parsed.data.userId,
        email: parsed.data.email,
      });
      if (!r) {
        return NextResponse.json(
          {
            error:
              "No user found with that email yet. Ask them to sign in once, then try again.",
          },
          { status: 404 }
        );
      }
      await auditEvent({
        actorUserId: me.id,
        targetUserId: r.id,
        eventType: "ADMIN_PROMOTED_USER",
        severity: "warning",
        request: req,
        metadata: { byEmail: !!parsed.data.email },
      });
      return NextResponse.json({ ok: true, user: r });
    }

    if (parsed.data.action === "demote") {
      const r = await demoteFromAdmin(parsed.data.userId);
      if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await auditEvent({
        actorUserId: me.id,
        targetUserId: parsed.data.userId,
        eventType: "ADMIN_DEMOTED_USER",
        severity: "warning",
        request: req,
      });
      return NextResponse.json({ ok: true });
    }

    // transfer_head
    await transferHeadAdminTo(me.id, parsed.data.userId);
    await auditEvent({
      actorUserId: me.id,
      targetUserId: parsed.data.userId,
      eventType: "ADMIN_TRANSFERRED_HEAD",
      severity: "critical",
      request: req,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Operation failed" },
      { status: 400 }
    );
  }
}
