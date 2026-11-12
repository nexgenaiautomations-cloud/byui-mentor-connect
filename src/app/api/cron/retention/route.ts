import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runRetention } from "@/lib/retention-server";

// Weekly (vercel.json). Report-only unless RETENTION_MODE=enforce, and even
// then deletes only rules marked `enforce` in src/lib/retention.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req, "retention")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runRetention()) });
  } catch (e) {
    console.error("cron/retention failed:", e);
    return NextResponse.json({ ok: false, error: "Retention job failed" }, { status: 500 });
  }
}
