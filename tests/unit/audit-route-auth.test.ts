import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock requireAdmin: it throws a 403 Response for non-admins, returns a user
// for admins. The audit-events route should never reach the DB select if the
// admin check fails.
vi.mock("@/lib/session", () => {
  const requireAdmin = vi.fn();
  return { requireAdmin, __spy: { requireAdmin } };
});

// Provide a stub `db` so import resolution succeeds even when the test
// doesn't expect any DB call.
vi.mock("@/db/client", () => {
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      })),
    })),
  }));
  return { db: { select } };
});

import { GET } from "@/app/api/admin/audit-events/route";
import * as sessionModule from "@/lib/session";

type SpyBag = { __spy: { requireAdmin: ReturnType<typeof vi.fn> } };
const spy = (sessionModule as unknown as SpyBag).__spy;

describe("GET /api/admin/audit-events", () => {
  beforeEach(() => {
    spy.requireAdmin.mockReset();
  });

  it("returns 403 when the caller is not an admin", async () => {
    spy.requireAdmin.mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 })
    );
    const res = await GET(
      new Request("https://app.example/api/admin/audit-events")
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when there is no session", async () => {
    spy.requireAdmin.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );
    const res = await GET(
      new Request("https://app.example/api/admin/audit-events")
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid query params (bad limit)", async () => {
    spy.requireAdmin.mockResolvedValueOnce({ id: "admin", isAdmin: true });
    const res = await GET(
      new Request("https://app.example/api/admin/audit-events?limit=abc")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on unknown eventType (rejected before hitting Postgres)", async () => {
    spy.requireAdmin.mockResolvedValueOnce({ id: "admin", isAdmin: true });
    const res = await GET(
      new Request(
        "https://app.example/api/admin/audit-events?eventType=DROP_TABLE_USERS"
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on unknown severity", async () => {
    spy.requireAdmin.mockResolvedValueOnce({ id: "admin", isAdmin: true });
    const res = await GET(
      new Request(
        "https://app.example/api/admin/audit-events?severity=catastrophic"
      )
    );
    expect(res.status).toBe(400);
  });

  it("calls requireAdmin before any DB work", async () => {
    spy.requireAdmin.mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 })
    );
    await GET(new Request("https://app.example/api/admin/audit-events"));
    expect(spy.requireAdmin).toHaveBeenCalledOnce();
  });
});
