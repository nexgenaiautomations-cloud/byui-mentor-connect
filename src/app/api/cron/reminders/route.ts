import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runReminderJob } from "@/lib/reminder-job";

// Hourly (vercel.json, Vercel Pro). Meeting reminders, follow-ups,
// confirmations, action-item nudges and inactivity nudges.
// Sends nothing unless NOTIFICATIONS_MODE is "live" ("dry_run" records what
// would have been sent). Protected by CRON_SECRET like the other jobs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req, "reminders")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runReminderJob(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("cron/reminders failed:", e);
    return NextResponse.json({ ok: false, error: "Reminder job failed" }, { status: 500 });
  }
}
