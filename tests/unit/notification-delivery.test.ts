// The notification delivery state machine (src/lib/notifications-server.ts):
// claim → (dry_run | send → sent | failed) with retries, opt-outs and caps.
import { describe, it, expect, vi, beforeEach } from "vitest";

const fake = vi.hoisted(() => {
  const queue: unknown[][] = [];
  const calls: { op: string; args: unknown[] }[] = [];
  const chain: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") {
        const result = queue.length ? queue.shift() : [];
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return (...args: unknown[]) => {
        calls.push({ op: String(prop), args });
        return chain;
      };
    },
  });
  const db = new Proxy({}, { get: (_t, prop) => (...args: unknown[]) => { calls.push({ op: String(prop), args }); return chain; } });
  return { db, queue, calls, push: (...r: unknown[][]) => queue.push(...r) };
});
vi.mock("@/db/client", () => ({ db: fake.db }));
const email = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email", () => email);

import { deliver, newRunState, type Candidate } from "@/lib/notifications-server";

const now = new Date("2026-06-01T12:00:00Z");
const cand = (over: Partial<Candidate> = {}): Candidate => ({
  dedupeKey: "meeting_24h:m1:2026-06-02T12:00:00.000Z:u1",
  userId: "u1",
  email: "u1@byui.edu",
  kind: "meeting_24h",
  matchId: "m1",
  ctx: { appUrl: "https://x", recipientFirstName: "A", otherFirstName: "B", recipientRole: "mentee" },
  ...over,
});
const sets = () => fake.calls.filter((c) => c.op === "set").map((c) => c.args[0] as Record<string, unknown>);
const inserted = () => fake.calls.filter((c) => c.op === "values").map((c) => c.args[0] as Record<string, unknown>);

beforeEach(() => {
  fake.queue.length = 0;
  fake.calls.length = 0;
  email.sendEmail.mockReset().mockResolvedValue({ ok: true });
});

describe("deliver()", () => {
  it("dry run claims the key and records it without sending", async () => {
    const st = newRunState("dry_run", 50);
    fake.push([{ id: "d1" }], []);
    expect(await deliver(cand(), st, now)).toBe("dry_run");
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(sets()).toContainEqual({ status: "dry_run" });
  });

  it("live sends once, with the dedupe key as Resend's idempotency key", async () => {
    const st = newRunState("live", 50);
    fake.push([{ id: "d1" }], []);
    expect(await deliver(cand(), st, now)).toBe("sent");
    expect(email.sendEmail).toHaveBeenCalledOnce();
    expect(email.sendEmail.mock.calls[0][0].idempotencyKey).toBe(cand().dedupeKey);
    expect(sets().at(-1)).toMatchObject({ status: "sent" });
  });

  it("an already-claimed key (sent, dry run, or in flight) is a duplicate and never re-sent", async () => {
    const st = newRunState("live", 50);
    fake.push([], []); // insert conflict, and no failed/stale row to retry
    expect(await deliver(cand(), st, now)).toBe("duplicate");
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it("a previously failed (or crashed, stale pending) key is retried via a guarded update", async () => {
    const st = newRunState("live", 50);
    fake.push([], [{ id: "d1" }], []);
    expect(await deliver(cand(), st, now)).toBe("sent");
    const retry = fake.calls.find((c) => c.op === "set" && "attempts" in (c.args[0] as object));
    expect(retry).toBeTruthy();
  });

  it("a Resend error marks it failed with the reason (retried on a later run)", async () => {
    email.sendEmail.mockResolvedValue({ ok: false, error: "Resend error: 500" });
    const st = newRunState("live", 50);
    fake.push([{ id: "d1" }], []);
    expect(await deliver(cand(), st, now)).toBe("failed");
    expect(sets().at(-1)).toMatchObject({ status: "failed", lastError: "Resend error: 500" });
  });

  it("a thrown send (network) is contained and recorded as failed", async () => {
    email.sendEmail.mockRejectedValue(new Error("ECONNRESET"));
    const st = newRunState("live", 50);
    fake.push([{ id: "d1" }], []);
    expect(await deliver(cand(), st, now)).toBe("failed");
    expect(sets().at(-1)).toMatchObject({ status: "failed", lastError: "ECONNRESET" });
  });

  it("respects opt-outs: records skipped_optout, never claims or sends", async () => {
    const st = newRunState("live", 50);
    st.prefs.set("u1", { meetingReminders: false, followUps: true, inactivityNudges: true });
    expect(await deliver(cand(), st, now)).toBe("skipped_optout");
    expect(inserted()[0]).toMatchObject({ status: "skipped_optout" });
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it("enforces the per-user daily cap without consuming the key", async () => {
    const st = newRunState("live", 50);
    st.recent.set("u1", 3);
    expect(await deliver(cand(), st, now)).toBe("skipped_cap");
    expect(fake.calls).toHaveLength(0);
  });

  it("enforces the per-run cap", async () => {
    const st = newRunState("live", 1);
    fake.push([{ id: "a" }], []);
    expect(await deliver(cand(), st, now)).toBe("sent");
    expect(await deliver(cand({ userId: "u2", dedupeKey: "k2" }), st, now)).toBe("run_cap");
    expect(email.sendEmail).toHaveBeenCalledOnce();
  });
});

describe("sendEmail safety", () => {
  it("fails safely when Resend isn't configured, and log-only mode is ignored in production", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/email");
    vi.stubEnv("AUTH_RESEND_KEY", "");
    vi.stubEnv("EMAIL_TRANSPORT", "log");
    vi.stubEnv("NODE_ENV", "production");
    const real = await import("@/lib/email");
    const res = await real.sendEmail({ to: "a@b.edu", subject: "s", html: "h", text: "t" });
    expect(res.ok).toBe(false);
    expect(real.emailDeliveryDisabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "test");
    expect(real.emailDeliveryDisabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});
