// Negative security tests for the school boundary (docs: src/lib/admin-scope.ts).
// A program admin at byui.edu must not read or change anything belonging to
// state.edu; platform admins keep their explicitly granted cross-school access.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

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

const flags = vi.hoisted(() => ({ platform: false }));
vi.mock("@/lib/platform-admin", () => ({ isPlatformAdmin: () => flags.platform }));

const session = vi.hoisted(() => ({ getCurrentUser: vi.fn(), requireAdmin: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/audit", () => ({ auditEvent: vi.fn() }));
vi.mock("@/lib/mentor-waitlist-server", () => ({ notifyWaitingMentees: vi.fn() }));
const reports = vi.hoisted(() => ({ loadReport: vi.fn() }));
vi.mock("@/lib/reports-server", () => reports);
const program = vi.hoisted(() => ({
  loadProgramData: vi.fn(),
  loadRoiTracked: vi.fn(),
  openInterventionStudents: vi.fn(),
  interventionOutcomes: vi.fn(),
  parseProgramFilters: (p: Record<string, string | undefined>) => ({ school: (p.school ?? "").toLowerCase(), department: "", major: "", pod: "", cohort: "" }),
}));
vi.mock("@/lib/effectiveness-server", () => program);

import { adminScopeFor, auditEventInScope, emailInScope, userIdInScope } from "@/lib/admin-scope";
import { users, auditEvents, matches as matchesTable } from "@/db/schema";
import { POST as userPost, PATCH as userPatch } from "@/app/api/admin/users/[id]/route";
import { DELETE as matchDelete } from "@/app/api/admin/matches/[id]/route";
import { PATCH as appPatch } from "@/app/api/mentor-applications/[id]/route";
import { POST as adminsPost } from "@/app/api/admin/admins/route";
import { GET as kpisGet } from "@/app/api/kpis/route";
import { PATCH as logPatch } from "@/app/api/meeting-logs/[id]/route";
import { GET as reportCsv } from "@/app/api/admin/reports/csv/route";
import { GET as programCsv } from "@/app/api/admin/program-report/csv/route";
import { availableRoles, defaultRole } from "@/lib/roles";

const byuiAdmin = {
  id: "adm",
  email: "boss@byui.edu",
  isAdmin: true,
  isHeadAdmin: true,
  isMentor: true,
  isExecutiveMentor: false,
  deactivatedAt: null,
};
const stateStudent = { id: "st1", email: "kid@state.edu", isAdmin: false, isHeadAdmin: false, isMentor: false, isExecutiveMentor: false, deactivatedAt: null };
const byuiStudent = { ...stateStudent, id: "by1", email: "kid@byui.edu" };
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown, method = "POST") => new Request("https://x/api", { method, body: JSON.stringify(body) });
const render = (q: ReturnType<typeof emailInScope>) => new PgDialect().sqlToQuery(q);

beforeEach(() => {
  fake.queue.length = 0;
  fake.calls.length = 0;
  flags.platform = false;
  for (const f of Object.values(session)) f.mockReset();
  reports.loadReport.mockReset().mockResolvedValue({ rows: [], matchesStarted: 0, requestsMade: 0 });
  program.loadProgramData.mockReset().mockResolvedValue({ students: [], matches: [], logs: [], feedback: [], milestones: [], options: { majors: [], pods: [], cohorts: [], schools: [] }, studentById: new Map() });
  session.requireAdmin.mockResolvedValue(byuiAdmin);
  session.getCurrentUser.mockResolvedValue(byuiAdmin);
});

describe("scope SQL is always constrained to the admin's school", () => {
  it("program admins get a school filter bound as a parameter", () => {
    const scope = adminScopeFor(byuiAdmin)!;
    for (const q of [
      emailInScope(users.email, scope),
      userIdInScope(matchesTable.menteeId, scope),
      auditEventInScope(auditEvents.actorUserId, auditEvents.targetUserId, scope),
    ]) {
      const r = render(q);
      expect(r.params).toContain("byui.edu");
      expect(r.sql).not.toContain("byui.edu"); // parameterized, never inlined
    }
  });
  it("a requested school is ignored for program admins", () => {
    expect(adminScopeFor(byuiAdmin, "state.edu")!.school).toBe("byui.edu");
  });
  it("only platform admins can widen to all schools", () => {
    flags.platform = true;
    expect(adminScopeFor(byuiAdmin)!.school).toBeNull();
    expect(render(emailInScope(users.email, adminScopeFor(byuiAdmin)!)).sql).toBe("true");
  });
  it("non-admins get no scope at all", () => {
    expect(adminScopeFor({ ...byuiAdmin, isAdmin: false })).toBeNull();
  });
});

describe("cross-school writes are refused (and nothing is written)", () => {
  it("can't change another school's member's role", async () => {
    fake.push([stateStudent]);
    const res = await userPost(json({ action: "set_role", role: "mentor" }), params("st1"));
    expect(res.status).toBe(404);
    expect(fake.ops()).not.toContain("update");
  });
  it("can't remove another school's member", async () => {
    fake.push([stateStudent]);
    expect((await userPost(json({ action: "remove" }), params("st1"))).status).toBe(404);
    expect(fake.ops()).not.toContain("update");
  });
  it("can still manage their own school's member", async () => {
    fake.push([byuiStudent]);
    expect((await userPost(json({ action: "set_role", role: "mentor" }), params("by1"))).status).toBe(200);
  });
  it("can't edit another school's member's profile", async () => {
    fake.push([stateStudent]);
    expect((await userPatch(json({ firstName: "Hacked" }, "PATCH"), params("st1"))).status).toBe(404);
    expect(fake.ops()).not.toContain("update");
  });
  it("can edit their own school's member's profile but not their email", async () => {
    fake.push([{ ...byuiStudent, firstName: "Old", lastName: "Name", name: "Old Name" }]);
    expect((await userPatch(json({ firstName: "New" }, "PATCH"), params("by1"))).status).toBe(200);
    expect(fake.ops()).toContain("update");
    expect((await userPatch(json({ email: "x@state.edu" }, "PATCH"), params("by1"))).status).toBe(400);
  });
  it("can't end another school's match", async () => {
    fake.push([{ menteeId: "st1" }], [{ email: "kid@state.edu" }]);
    expect((await matchDelete(new Request("https://x", { method: "DELETE" }), params("m1"))).status).toBe(404);
    expect(fake.ops()).not.toContain("update");
  });
  it("can't approve another school's mentor application", async () => {
    fake.push([{ id: "a1", userId: "st1", status: "pending", capacity: 3 }], [{ email: "kid@state.edu" }]);
    expect((await appPatch(json({ action: "approve" }, "PATCH"), params("a1"))).status).toBe(404);
    expect(fake.ops()).not.toContain("update");
  });
  it("head admin can't promote someone at another school", async () => {
    fake.push([{ email: "kid@state.edu" }]);
    const res = await adminsPost(json({ action: "promote", email: "kid@state.edu" }));
    expect(res.status).toBe(404);
    expect(fake.ops()).not.toContain("update");
  });
  it("can't edit another school's activity log as an admin", async () => {
    fake.push([{ id: "l1", studentId: "st1", mentorId: "x", createdBy: "mentee", isSystemGenerated: false, matchId: null }], [{ email: "kid@state.edu" }], []);
    const res = await logPatch(json({ actionItems: "x" }, "PATCH"), params("l1"));
    expect(res.status).toBe(403);
    expect(fake.ops()).not.toContain("update");
  });
});

describe("cross-school reads are refused", () => {
  it("can't read another school's student KPIs", async () => {
    fake.push([{ email: "kid@state.edu" }]);
    expect((await kpisGet(new Request("https://x/api/kpis?studentId=st1"))).status).toBe(403);
  });
  it("reports CSV is loaded with the admin's own school even if another is requested", async () => {
    await reportCsv(new Request("https://x/api/admin/reports/csv?school=state.edu"));
    expect(reports.loadReport.mock.calls[0][1]).toEqual({ school: "byui.edu", platform: false });
  });
  it("program CSV exports are pinned to the admin's school", async () => {
    program.loadRoiTracked.mockResolvedValue({ loggedMinutes: 0, interactionsLogged: 0, interactionsWithoutDuration: 0, remindersDelivered: 0, followUpsDelivered: 0, followUpTasksCompleted: 0, interventionsRecorded: 0, casesResolved: 0 });
    fake.push([], []); // ROI settings
    const res = await programCsv(new Request("https://x/api/admin/program-report/csv?report=roi&school=state.edu"));
    expect(res.status).toBe(200);
    expect(program.loadProgramData.mock.calls[0][0]).toEqual({ school: "byui.edu", platform: false });
    expect(await res.text()).not.toContain("state.edu");
  });
  it("platform admins keep their authorized cross-school export", async () => {
    flags.platform = true;
    await reportCsv(new Request("https://x/api/admin/reports/csv"));
    expect(reports.loadReport.mock.calls[0][1]).toEqual({ school: null, platform: true });
  });
});

describe("role switching can't escalate", () => {
  it("a non-admin can never select the admin role", () => {
    const member = { ...byuiStudent, isAdmin: false, isMentor: true } as never;
    expect(availableRoles(member)).not.toContain("admin");
    expect(defaultRole(member)).not.toBe("admin");
  });
  it("admin APIs check the database flag, not the role cookie", async () => {
    session.requireAdmin.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    expect((await reportCsv(new Request("https://x/api/admin/reports/csv", { headers: { cookie: "byui-can-role=admin" } }))).status).toBe(403);
    expect(reports.loadReport).not.toHaveBeenCalled();
  });
});
