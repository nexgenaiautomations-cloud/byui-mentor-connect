import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

// Vercel cron sends `Authorization: Bearer $CRON_SECRET`. Constant-time
// compare; a missing secret refuses every request (and says so loudly).
export function isAuthorizedCron(req: Request, job: string, secret = process.env.CRON_SECRET): boolean {
  if (!secret) {
    console.error(`cron/${job}: CRON_SECRET is not set — scheduled job cannot run`);
    return false;
  }
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
