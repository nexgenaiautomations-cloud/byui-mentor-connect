// Pod (team) leaderboard scoring. Shaun Franklin, 2026-11-09: every activity
// is 1 point, major activities (internship / job offers) are 5, and the
// board resets on the first of every month.

import { keyForLabel } from "@/lib/possible-actions";

export const MAJOR_ACTIVITY_POINTS = 5;
export const MAJOR_ACTIVITY_KEYS = new Set(["internship_offer", "part_time_offer", "full_time_offer"]);

export const LEADERBOARD_TIME_ZONE = "America/Denver";

export function logPoints(log: { topicsDiscussed: string | null; isSystemGenerated: boolean }): number {
  if (log.isSystemGenerated) return 0;
  const parts = (log.topicsDiscussed ?? "")
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return 1;
  const recognised = parts.filter((p) => keyForLabel(p) || p.startsWith("Other:"));
  if (recognised.length === 0) return 1; // older free-text log = one activity
  return recognised.reduce((sum, p) => {
    const key = keyForLabel(p);
    return sum + (key && MAJOR_ACTIVITY_KEYS.has(key) ? MAJOR_ACTIVITY_POINTS : 1);
  }, 0);
}

// Offset (ms) of `zone` from UTC at instant `d`, e.g. -7h for MST.
function zoneOffsetMs(d: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

// Midnight at the start of local calendar day y-m-d (month 0-based, day may
// overflow, e.g. d = 32) in `zone`, as a UTC Date. DST-safe.
export function zonedMidnight(y: number, m: number, d: number, zone = LEADERBOARD_TIME_ZONE): Date {
  const naive = Date.UTC(y, m, d);
  const first = naive - zoneOffsetMs(new Date(naive), zone);
  return new Date(naive - zoneOffsetMs(new Date(first), zone));
}

// Local calendar date of `d` in `zone` (month 0-based).
export function zonedParts(d: Date, zone = LEADERBOARD_TIME_ZONE) {
  const local = new Date(d.getTime() + zoneOffsetMs(d, zone));
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() };
}

// Midnight on the 1st of the current month in Mountain time, as a UTC Date.
export function currentMonthStart(now: Date = new Date(), zone = LEADERBOARD_TIME_ZONE): Date {
  const { y, m } = zonedParts(now, zone);
  return zonedMidnight(y, m, 1, zone);
}

export type PodScore = { id: string; name: string; points: number; members: number };

// Highest points first; ties share a rank (1, 2, 2, 4) and sort by name.
export function rankPods<P extends PodScore>(pods: P[]): (P & { rank: number })[] {
  const sorted = [...pods].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  return sorted.map((p, i) => ({
    ...p,
    rank: sorted.findIndex((q) => q.points === p.points) + 1 || i + 1,
  }));
}
