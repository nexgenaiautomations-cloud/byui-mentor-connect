import "server-only";
// Idempotent delivery of one notification. The unique dedupe_key on
// notification_delivery is the guard: we claim the key with an INSERT before
// sending, so overlapping or retried cron runs can't double-send.
import { and, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationDeliveries, notificationPreferences } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { buildNotificationEmail, type EmailContext } from "@/lib/notification-email";
import {
  allowedByPreferences,
  DEFAULT_PREFERENCES,
  MAX_ATTEMPTS,
  underUserCap,
  type NotificationKind,
  type NotificationMode,
  type Preferences,
} from "@/lib/notifications";

export type Candidate = {
  dedupeKey: string;
  userId: string;
  email: string;
  kind: NotificationKind;
  matchId?: string | null;
  scheduledMeetingId?: string | null;
  ctx: EmailContext;
};

export type DeliveryOutcome =
  | "sent"
  | "dry_run"
  | "failed"
  | "skipped_optout"
  | "skipped_cap"
  | "duplicate"
  | "run_cap";

export type RunState = {
  mode: Exclude<NotificationMode, "off">;
  maxPerRun: number;
  attempted: number;
  prefs: Map<string, Preferences>;
  recent: Map<string, number>;
  outcomes: Record<DeliveryOutcome, number>;
};

export function newRunState(mode: RunState["mode"], maxPerRun: number): RunState {
  return {
    mode,
    maxPerRun,
    attempted: 0,
    prefs: new Map(),
    recent: new Map(),
    outcomes: { sent: 0, dry_run: 0, failed: 0, skipped_optout: 0, skipped_cap: 0, duplicate: 0, run_cap: 0 },
  };
}

// Load preferences + rolling-24h counts for everyone we might notify.
export async function primeRunState(state: RunState, userIds: string[], now: Date) {
  const ids = [...new Set(userIds)].filter((id) => !state.prefs.has(id));
  if (ids.length === 0) return;
  const [prefs, recent] = await Promise.all([
    db.select().from(notificationPreferences).where(inArray(notificationPreferences.userId, ids)),
    db
      .select({ userId: notificationDeliveries.userId, n: sql<number>`count(*)::int` })
      .from(notificationDeliveries)
      .where(
        and(
          inArray(notificationDeliveries.userId, ids),
          gte(notificationDeliveries.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
          inArray(notificationDeliveries.status, ["sent", "dry_run", "pending"])
        )
      )
      .groupBy(notificationDeliveries.userId),
  ]);
  const byUser = new Map(prefs.map((p) => [p.userId, p]));
  for (const id of ids) {
    const p = byUser.get(id);
    state.prefs.set(
      id,
      p
        ? { meetingReminders: p.meetingReminders, followUps: p.followUps, inactivityNudges: p.inactivityNudges }
        : DEFAULT_PREFERENCES
    );
    state.recent.set(id, 0);
  }
  for (const r of recent) if (r.userId) state.recent.set(r.userId, r.n);
}

async function claim(c: Candidate, now: Date): Promise<string | null> {
  const inserted = await db
    .insert(notificationDeliveries)
    .values({
      dedupeKey: c.dedupeKey,
      userId: c.userId,
      kind: c.kind,
      matchId: c.matchId ?? null,
      scheduledMeetingId: c.scheduledMeetingId ?? null,
      status: "pending",
      attempts: 1,
    })
    .onConflictDoNothing({ target: notificationDeliveries.dedupeKey })
    .returning({ id: notificationDeliveries.id });
  if (inserted[0]) return inserted[0].id;
  // Retry: a previous attempt failed, or a run died mid-send (stale pending).
  const retried = await db
    .update(notificationDeliveries)
    .set({ status: "pending", attempts: sql`${notificationDeliveries.attempts} + 1` })
    .where(
      and(
        eq(notificationDeliveries.dedupeKey, c.dedupeKey),
        lt(notificationDeliveries.attempts, MAX_ATTEMPTS),
        or(
          eq(notificationDeliveries.status, "failed"),
          and(
            eq(notificationDeliveries.status, "pending"),
            lt(notificationDeliveries.createdAt, new Date(now.getTime() - 60 * 60 * 1000))
          )
        )
      )
    )
    .returning({ id: notificationDeliveries.id });
  return retried[0]?.id ?? null;
}

export async function deliver(c: Candidate, state: RunState, now: Date): Promise<DeliveryOutcome> {
  const done = (o: DeliveryOutcome) => {
    state.outcomes[o] += 1;
    return o;
  };
  if (state.attempted >= state.maxPerRun) return done("run_cap");

  if (!allowedByPreferences(c.kind, state.prefs.get(c.userId))) {
    // Record the opt-out once so reporting can show it; never retried.
    await db
      .insert(notificationDeliveries)
      .values({ dedupeKey: c.dedupeKey, userId: c.userId, kind: c.kind, matchId: c.matchId ?? null, scheduledMeetingId: c.scheduledMeetingId ?? null, status: "skipped_optout" })
      .onConflictDoNothing({ target: notificationDeliveries.dedupeKey });
    return done("skipped_optout");
  }
  // Not recorded: the reminder can still go out on a later run if its
  // window is open and the person is under the cap by then.
  if (!underUserCap(state.recent.get(c.userId) ?? 0)) return done("skipped_cap");

  const id = await claim(c, now);
  if (!id) return done("duplicate");
  state.attempted += 1;
  state.recent.set(c.userId, (state.recent.get(c.userId) ?? 0) + 1);

  if (state.mode === "dry_run") {
    await db.update(notificationDeliveries).set({ status: "dry_run" }).where(eq(notificationDeliveries.id, id));
    return done("dry_run");
  }

  const email = buildNotificationEmail(c.kind, c.ctx, c.email);
  let result: Awaited<ReturnType<typeof sendEmail>>;
  try {
    result = await sendEmail({
      to: c.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      refId: id,
      idempotencyKey: c.dedupeKey,
    });
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : "send threw" };
  }
  if (result.ok) {
    await db
      .update(notificationDeliveries)
      .set({ status: "sent", sentAt: new Date(), lastError: null })
      .where(eq(notificationDeliveries.id, id));
    return done("sent");
  }
  await db
    .update(notificationDeliveries)
    .set({ status: "failed", lastError: result.error.slice(0, 500) })
    .where(eq(notificationDeliveries.id, id));
  return done("failed");
}
