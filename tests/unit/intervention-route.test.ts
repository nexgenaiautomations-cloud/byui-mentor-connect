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
  return { db, queue, calls, push: (...r: unknown[][]) => queue.push(...r), ops: () => calls.map((c) => c.op) };
});
vi.mock("@/db/client", () => ({ db: fake.db }));
const session = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/audit", () => ({ auditEvent: vi.fn() }));
vi.mock("@/lib/platform-admin", () => ({ isPlatformAdmin: () => false }));

import { PATCH } from "@/app/api/admin/interventions/[id]/route";

const req = (body: unknown) => new Request("https://x", { method: "PATCH", body: JSON.stringify(body) });
const p = { params: Promise.resolve({ id: "c1" }) };
const admin = { id: "adm", email: "a@byui.edu", isAdmin: true, isExecutiveMentor: false };
const otherAdmin = { id: "adm2", email: "b@state.edu", isAdmin: true, isExecutiveMentor: false };
const exec = { id: "exe", email: "e@byui.edu", isAdmin: false, isExecutiveMentor: true };
const baseCase = {
  id: "c1",
  school: "byui.edu",
  status: "new",
  assignedToId: null as string | null,
  studentId: "stu",
  lastOutreachAt: null as Date | null,
  lastOutreachById: null as string | null,
};

beforeEach(() => {
  fake.queue.length = 0;
  fake.calls.length = 0;
  session.getCurrentUser.mockReset();
});

describe("PATCH /api/admin/interventions/:id", () => {
  it("401 without a session", async () => {
    session.getCurrentUser.mockResolvedValue(null);
    expect((await PATCH(req({ action: "note", note: "x" }), p)).status).toBe(401);
  });
  it("another school's admin sees not found and nothing is written", async () => {
    session.getCurrentUser.mockResolvedValue(otherAdmin);
    fake.push([baseCase]);
    expect((await PATCH(req({ action: "note", note: "x" }), p)).status).toBe(404);
    expect(fake.ops()).not.toContain("update");
  });
  it("an executive mentor not assigned to the case sees not found", async () => {
    session.getCurrentUser.mockResolvedValue(exec);
    fake.push([baseCase]);
    expect((await PATCH(req({ action: "note", note: "x" }), p)).status).toBe(404);
  });
  it("the assigned executive mentor can record outreach but not reassign", async () => {
    session.getCurrentUser.mockResolvedValue(exec);
    fake.push([{ ...baseCase, assignedToId: "exe" }]);
    expect((await PATCH(req({ action: "assign", assigneeId: null }), p)).status).toBe(403);
    fake.push([{ ...baseCase, assignedToId: "exe" }]);
    expect((await PATCH(req({ action: "outreach" }), p)).status).toBe(200);
  });
  it("refuses invalid status transitions", async () => {
    session.getCurrentUser.mockResolvedValue(admin);
    fake.push([{ ...baseCase, status: "closed" }]);
    expect((await PATCH(req({ action: "status", status: "contacted" }), p)).status).toBe(409);
  });
  it("warns before duplicate outreach and records it when confirmed", async () => {
    session.getCurrentUser.mockResolvedValue(admin);
    const recent = { ...baseCase, status: "contacted", lastOutreachAt: new Date(Date.now() - 3600000), lastOutreachById: "someone" };
    fake.push([recent], [{ name: "Pat" }]);
    const res = await PATCH(req({ action: "outreach" }), p);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/Pat already reached out/);
    fake.push([recent]);
    expect((await PATCH(req({ action: "outreach", force: true }), p)).status).toBe(200);
  });
  it("only assigns same-school admins or executive mentors", async () => {
    session.getCurrentUser.mockResolvedValue(admin);
    fake.push([baseCase], [{ id: "x", email: "x@state.edu", isAdmin: true, isExecutiveMentor: false, deactivatedAt: null }]);
    expect((await PATCH(req({ action: "assign", assigneeId: "x" }), p)).status).toBe(400);
    fake.push([baseCase], [{ id: "y", email: "y@byui.edu", isAdmin: false, isExecutiveMentor: false, deactivatedAt: null }]);
    expect((await PATCH(req({ action: "assign", assigneeId: "y" }), p)).status).toBe(400);
    fake.calls.length = 0;
    fake.push([baseCase], [{ id: "z", name: "Zoe", email: "z@byui.edu", isAdmin: false, isExecutiveMentor: true, deactivatedAt: null }]);
    expect((await PATCH(req({ action: "assign", assigneeId: "z" }), p)).status).toBe(200);
    // Assigning a new case moves it to reviewing and is logged on the trail.
    const set = fake.calls.find((c) => c.op === "set")!.args[0] as Record<string, unknown>;
    expect(set).toMatchObject({ assignedToId: "z", status: "reviewing" });
    expect(fake.ops()).toContain("insert");
  });
});
