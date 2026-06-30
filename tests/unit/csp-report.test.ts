import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the audit module so we can observe what the route logs without
// touching the database.
vi.mock("@/lib/audit", () => {
  const auditEvent = vi.fn(async () => true);
  return { auditEvent, __spy: { auditEvent } };
});

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
});
