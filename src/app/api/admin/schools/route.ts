import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { schoolDomains, schoolInquiries } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { normalizeDomain } from "@/lib/school-domains";
import { auditEvent } from "@/lib/audit";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    domain: z.string().min(1).max(253),
    schoolName: z.string().trim().min(1).max(200),
  }),
  z.object({
    action: z.literal("set_active"),
    domain: z.string().min(1).max(253),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("inquiry_status"),
    id: z.string().uuid(),
    status: z.enum(["new", "contacted", "added", "declined"]),
  }),
]);

// Platform-admin only: add school email domains, switch them on/off, and
// track school inquiries.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPlatformAdmin(me)) {
    await auditEvent({
      actorUserId: me.id,
      eventType: "UNAUTHORIZED_ADMIN_ATTEMPT",
      severity: "critical",
      request: req,
      metadata: { route: "admin/schools", reason: "non_platform_admin" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = raw ? bodySchema.safeParse(raw) : null;
  if (!parsed || !parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const data = parsed.data;

  if (data.action === "inquiry_status") {
    await db.update(schoolInquiries).set({ status: data.status }).where(eq(schoolInquiries.id, data.id));
    return NextResponse.json({ ok: true });
  }

  const domain = normalizeDomain(data.domain);
  if (!domain) {
    return NextResponse.json({ error: "Enter a domain like school.edu." }, { status: 400 });
  }

  if (data.action === "add") {
    await db
      .insert(schoolDomains)
      .values({ domain, schoolName: data.schoolName, active: true, createdByUserId: me.id })
      .onConflictDoUpdate({
        target: schoolDomains.domain,
        set: { schoolName: data.schoolName, active: true },
      });
  } else {
    await db.update(schoolDomains).set({ active: data.active }).where(eq(schoolDomains.domain, domain));
  }

  await auditEvent({
    actorUserId: me.id,
    eventType: "SCHOOL_DOMAIN_CHANGED",
    severity: "warning",
    request: req,
    metadata: {
      action: data.action,
      domain,
      active: data.action === "add" ? true : data.active,
    },
  });

  return NextResponse.json({ ok: true });
}
