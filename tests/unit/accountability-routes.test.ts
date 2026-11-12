import { describe, it, expect, vi, beforeEach } from "vitest";
const fake = vi.hoisted(() => {
  // Inline copy of helpers/fake-db (vi.hoisted can't import).
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
  return { db, queue, calls, push: (...r: unknown[][]) => queue.push(...r), ops: () => calls.map((c) => c.op) };
});
vi.mock("@/db/client", () => ({ db: fake.db }));

const session = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireAdmin: vi.fn(),
}));
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/audit", () => ({ auditEvent: vi.fn() }));
vi.mock("@/lib/platform-admin", () => ({ isPlatformAdmin: () => false }));

import { POST as careerPost } from "@/app/api/career/route";
import { POST as verifyPost } from "@/app/api/admin/career/[id]/verify/route";
import { POST as confirmPost } from "@/app/api/meeting-logs/[id]/confirm/route";
import { POST as actionPost } from "@/app/api/meeting-logs/[id]/action-items/route";
import { PUT as prefsPut } from "@/app/api/me/notifications/route";

const json = (body: unknown) =>
  new Request("https://x/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const student = { id: "stu", email: "stu@byui.edu", isAdmin: false };
const admin = { id: "adm", email: "adm@byui.edu", isAdmin: true };

beforeEach(() => {
  fake.queue.length = 0;
  fake.calls.length = 0;
  session.getCurrentUser.mockReset();
  session.requireAdmin.mockReset();
});

describe("POST /api/career", () => {
  it("401 without a session", async () => {
    session.getCurrentUser.mockResolvedValue(null);
    expect((await careerPost(json({ stage: "applying" }))).status).toBe(401);
  });
  it("rejects an offer without a role type and never inserts", async () => {
    session.getCurrentUser.mockResolvedValue(student);
    fake.push([]); // own milestones
    const res = await careerPost(json({ stage: "offer_received" }));
    expect(res.status).toBe(400);
    expect(fake.ops()).not.toContain("insert");
  });
  it("rejects unknown stages and salary-style fields are ignored", async () => {
    session.getCurrentUser.mockResolvedValue(student);
    expect((await careerPost(json({ stage: "rich" }))).status).toBe(400);
  });
  it("records a valid update against the caller only", async () => {
    session.getCurrentUser.mockResolvedValue(student);
    fake.push([], [{ id: "new" }]);
    const res = await careerPost(json({ stage: "interviewing", opportunityType: "internship", salary: 99999 }));
    expect(res.status).toBe(201);
    const values = fake.calls.find((c) => c.op === "values")!.args[0] as Record<string, unknown>;
    expect(values.studentId).toBe("stu");
    expect(values).not.toHaveProperty("salary");
  });
});

describe("POST /api/admin/career/:id/verify", () => {
  it("passes through the admin guard's refusal", async () => {
    session.requireAdmin.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    expect((await verifyPost(json({ verified: true }), params("m1"))).status).toBe(403);
  });
  it("hides another school's milestone as not found", async () => {
    session.requireAdmin.mockResolvedValue(admin);
    fake.push([{ id: "m1", studentId: "s", email: "s@state.edu" }]);
    const res = await verifyPost(json({ verified: true }), params("m1"));
    expect(res.status).toBe(404);
    expect(fake.ops()).not.toContain("update");
  });
  it("verifies a same-school milestone", async () => {
    session.requireAdmin.mockResolvedValue(admin);
    fake.push([{ id: "m1", studentId: "s", email: "s@byui.edu" }], []);
    expect((await verifyPost(json({ verified: true }), params("m1"))).status).toBe(200);
    expect(fake.ops()).toContain("update");
  });
});

describe("meeting confirmations and action items", () => {
  it("only a participant can confirm, and only their own side", async () => {
    session.getCurrentUser.mockResolvedValue({ id: "outsider" });
    fake.push([{ id: "l1", matchId: "m1", eventKind: "mentor_meeting" }], [{ mentorId: "men", menteeId: "stu" }]);
    expect((await confirmPost(json({}), params("l1"))).status).toBe(403);

    session.getCurrentUser.mockResolvedValue({ id: "stu" });
    fake.calls.length = 0;
    fake.push([{ id: "l1", matchId: "m1", eventKind: "mentor_meeting" }], [{ mentorId: "men", menteeId: "stu" }], [{ id: "l1" }]);
    expect((await confirmPost(json({}), params("l1"))).status).toBe(200);
    expect(fake.calls.find((c) => c.op === "set")!.args[0]).toEqual({ menteeConfirmed: true });
  });
  it("independent activity can't be 'confirmed' as a meeting", async () => {
    session.getCurrentUser.mockResolvedValue({ id: "stu" });
    fake.push([{ id: "l1", matchId: "m1", eventKind: "independent_activity" }]);
    expect((await confirmPost(json({}), params("l1"))).status).toBe(400);
  });
  it("action items: outsiders are refused", async () => {
    session.getCurrentUser.mockResolvedValue({ id: "outsider" });
    fake.push([{ id: "l1", studentId: "stu", matchId: "m1", actionItems: "Send resume" }], [{ mentorId: "men" }]);
    expect((await actionPost(json({ done: true }), params("l1"))).status).toBe(403);
  });
});

describe("PUT /api/me/notifications", () => {
  it("rejects unknown time zones", async () => {
    session.getCurrentUser.mockResolvedValue(student);
    const req = new Request("https://x", {
      method: "PUT",
      body: JSON.stringify({ meetingReminders: true, followUps: true, inactivityNudges: false, timezone: "Mars/Base" }),
    });
    expect((await prefsPut(req)).status).toBe(400);
  });
  it("saves the caller's own preferences", async () => {
    session.getCurrentUser.mockResolvedValue(student);
    const req = new Request("https://x", {
      method: "PUT",
      body: JSON.stringify({ meetingReminders: false, followUps: true, inactivityNudges: true, timezone: "America/Boise" }),
    });
    expect((await prefsPut(req)).status).toBe(200);
    expect((fake.calls.find((c) => c.op === "values")!.args[0] as { userId: string }).userId).toBe("stu");
  });
});
