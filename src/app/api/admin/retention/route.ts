import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { auditEvent } from "@/lib/audit";
import { getRawSetting } from "@/lib/program-settings-server";
import { RETENTION_REPORT_KEY, runRetention } from "@/lib/retention-server";

// Platform-wide data, so platform admins only.
async function guard(req: Request) {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!me.isAdmin || !isPlatformAdmin(me)) {
    void auditEvent({ actorUserId: me.id, eventType: "UNAUTHORIZED_ADMIN_ATTEMPT", severity: "warning", request: req, metadata: { route: "admin/retention" } });
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { me };
}

// GET: the last stored run report.
export async function GET(req: Request) {
  const g = await guard(req);
  if (g.error) return g.error;
  const raw = await getRawSetting("*", RETENTION_REPORT_KEY);
  return NextResponse.json({ lastRun: raw ? JSON.parse(raw) : null });
}

// POST: run a report-only pass now. Deletion is never triggered from here.
export async function POST(req: Request) {
  const g = await guard(req);
  if (g.error) return g.error;
  return NextResponse.json(await runRetention({ mode: "report", actorUserId: g.me!.id }));
}
