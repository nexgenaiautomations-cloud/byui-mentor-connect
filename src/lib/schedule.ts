// Timezone + reminder-timing math. Pure; DST-safe via Intl.
// See docs/specs/accountability-upgrade.md §3 for the reminder rules.
import { DAY_MS } from "@/lib/engagement";

export const DEFAULT_TIME_ZONE = "America/Denver";
// Date-only reminders go out from this local hour.
export const DATE_ONLY_REMINDER_HOUR = 9;
const HOUR_MS = 60 * 60 * 1000;

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function parseHHMM(v: string | null | undefined): { h: number; m: number } | null {
  if (!v) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

export function isDateStr(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

function offsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// Wall-clock `date` + `time` (or midnight) in `tz` → the UTC instant.
export function zonedToUtc(date: string, time: string | null, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const hm = parseHHMM(time) ?? { h: 0, m: 0 };
  const wall = Date.UTC(y, mo - 1, d, hm.h, hm.m);
  // Two passes handle instants next to a DST switch.
  let guess = wall - offsetMs(new Date(wall), tz);
  guess = wall - offsetMs(new Date(guess), tz);
  return new Date(guess);
}

export function localDateStr(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

// Accepts a JS Date produced by z.coerce.date("YYYY-MM-DD") (UTC midnight)
// or a full timestamp; returns the calendar date the user picked.
export function dateInputToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type ScheduledShape = {
  scheduledDate: string;
  scheduledTime: string | null;
  timezone: string;
  startsAt: Date;
  status: string;
};

export type MeetingReminderKind = "meeting_24h" | "meeting_1h" | "log_followup" | "mark_missed";

// When does each reminder become due, and until when is it still useful?
// [from, until) — the hourly job sends anything inside the window that
// hasn't been sent yet, so a skipped run doesn't lose a reminder.
export function reminderWindow(
  m: ScheduledShape,
  kind: MeetingReminderKind
): { from: Date; until: Date } | null {
  const hasTime = parseHHMM(m.scheduledTime) !== null;
  const nineAm = (date: string) => zonedToUtc(date, `0${DATE_ONLY_REMINDER_HOUR}:00`, m.timezone);
  const followFrom = hasTime
    ? new Date(m.startsAt.getTime() + 2 * HOUR_MS)
    : nineAm(addDays(m.scheduledDate, 1));
  switch (kind) {
    case "meeting_24h":
      return hasTime
        ? { from: new Date(m.startsAt.getTime() - 24 * HOUR_MS), until: new Date(m.startsAt.getTime() - HOUR_MS) }
        : { from: nineAm(addDays(m.scheduledDate, -1)), until: m.startsAt };
    case "meeting_1h":
      return hasTime ? { from: new Date(m.startsAt.getTime() - HOUR_MS), until: m.startsAt } : null;
    case "log_followup":
      return { from: followFrom, until: new Date(followFrom.getTime() + 7 * DAY_MS) };
    case "mark_missed":
      return { from: new Date(followFrom.getTime() + 7 * DAY_MS), until: new Date(8640000000000000) };
  }
}

export function isDue(m: ScheduledShape, kind: MeetingReminderKind, now: Date): boolean {
  if (m.status !== "scheduled") return false;
  const w = reminderWindow(m, kind);
  return !!w && now >= w.from && now < w.until;
}

// Does a logged interaction on `logDate` fulfil the scheduled meeting?
// Generous ±3 days: people reschedule by a day or two and still log it.
export function fulfils(m: { startsAt: Date }, logDate: Date): boolean {
  return Math.abs(logDate.getTime() - m.startsAt.getTime()) <= 3 * DAY_MS;
}
