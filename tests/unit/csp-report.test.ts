import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the audit module so we can observe what the route logs without
// touching the database. We also have to mock the IP-extraction helper
// because the route imports it from the same module to feed the
// rate-limiter.
vi.mock("@/lib/audit", () => {
  const auditEvent = vi.fn(async () => true);
  const extractIp = vi.fn(() => "1.2.3.4");
  return { auditEvent, extractIp, __spy: { auditEvent } };
});

// Rate-limit defaults to ok when Upstash isn't configured (test env), but
// be explicit so a future change to defaults can't break these tests.
vi.mock("@/lib/rate-limit", () => ({
  limitCspReport: vi.fn(async () => ({ ok: true })),
}));

import { POST } from "@/app/api/security/csp-report/route";
import * as auditModule from "@/lib/audit";

type SpyBag = { __spy: { auditEvent: ReturnType<typeof vi.fn> } };
const spy = (auditModule as unknown as SpyBag).__spy;

function makeReq(body: unknown, contentType = "application/csp-report") {
  return new Request("https://app.example/api/security/csp-report", {
    method: "POST",
    headers: { "content-type": contentType, "user-agent": "Mozilla/5.0" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/security/csp-report", () => {
  beforeEach(() => {
    spy.auditEvent.mockClear();
  });

  it("returns 204 and audits a legacy csp-report payload", async () => {
    const res = await POST(
      makeReq({
        "csp-report": {
          "blocked-uri": "https://evil.example/x.js",
          "violated-directive": "script-src",
          "document-uri": "https://app.example/dashboard",
        },
      })
    );
    expect(res.status).toBe(204);
    expect(spy.auditEvent).toHaveBeenCalledOnce();
    const call = spy.auditEvent.mock.calls[0][0];
    expect(call.eventType).toBe("CSP_VIOLATION_REPORTED");
    expect(call.severity).toBe("warning");
    expect(call.metadata.blockedUri).toBe("https://evil.example/x.js");
    expect(call.metadata.violatedDirective).toBe("script-src");
  });

  it("handles the modern Reporting API envelope", async () => {
    const res = await POST(
      makeReq([
        {
          type: "csp-violation",
          body: {
            blockedURL: "https://evil.example/y.css",
            effectiveDirective: "style-src",
            documentURL: "https://app.example/admin",
          },
        },
      ])
    );
    expect(res.status).toBe(204);
    const call = spy.auditEvent.mock.calls[0][0];
    expect(call.metadata.blockedUrl).toBe("https://evil.example/y.css");
    expect(call.metadata.effectiveDirective).toBe("style-src");
  });

  it("silently drops oversized payloads (no audit row)", async () => {
    const huge = "x".repeat(30_000);
    const res = await POST(makeReq(`{"junk":"${huge}"}`));
    expect(res.status).toBe(204);
    expect(spy.auditEvent).not.toHaveBeenCalled();
  });

  it("silently drops invalid JSON", async () => {
    const res = await POST(makeReq("not-json{"));
    expect(res.status).toBe(204);
    expect(spy.auditEvent).not.toHaveBeenCalled();
  });

  it("silently drops empty body", async () => {
    const res = await POST(makeReq(""));
    expect(res.status).toBe(204);
    expect(spy.auditEvent).not.toHaveBeenCalled();
  });

  it("never throws when audit insert fails internally", async () => {
    spy.auditEvent.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(
      makeReq({ "csp-report": { "blocked-uri": "data:text/html,x" } })
    );
    expect(res.status).toBe(204);
  });

  it("rate-limit short-circuit drops the report without auditing", async () => {
    const { limitCspReport } = await import("@/lib/rate-limit");
    (limitCspReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      reason: "ip",
    });
    const res = await POST(
      makeReq({ "csp-report": { "blocked-uri": "https://evil.example/x.js" } })
    );
    expect(res.status).toBe(204);
    expect(spy.auditEvent).not.toHaveBeenCalled();
  });
});
