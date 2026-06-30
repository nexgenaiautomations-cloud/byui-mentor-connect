import { NextResponse } from "next/server";
import { auditEvent } from "@/lib/audit";

// CSP violation report endpoint. The middleware sets
// `report-uri /api/security/csp-report` so the browser POSTs a JSON body
// (legacy `application/csp-report` or newer `application/reports+json`)
// whenever a directive blocks something.
//
// Design notes:
//   * Body size is hard-capped to MAX_BODY_BYTES — we don't want a single
//     misbehaving client to fill the audit table.
//   * Each report becomes one audit event (severity=warning). Browsers
//     coalesce identical violations on their side so we shouldn't see floods.
//   * The endpoint silently returns 204 to the browser regardless of outcome
//     — there's nothing useful to send back, and an error response can
//     accidentally trigger a retry loop.

const MAX_BODY_BYTES = 16 * 1024;

type CspReportPayload = {
  "csp-report"?: Record<string, unknown>;
  // The newer Reporting API wraps reports in an array of envelopes.
  type?: string;
  body?: Record<string, unknown>;
} | Array<{
  type?: string;
  body?: Record<string, unknown>;
}>;

function pickCspBody(payload: CspReportPayload): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    const csp = payload.find((r) => r.type === "csp-violation" || r.type === "csp");
    return csp?.body ?? payload[0]?.body ?? null;
  }
  if (payload && typeof payload === "object") {
    if ("csp-report" in payload && payload["csp-report"]) {
      return payload["csp-report"] as Record<string, unknown>;
    }
    if (payload.body) return payload.body;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    let payload: CspReportPayload | null = null;
    try {
      payload = raw ? (JSON.parse(raw) as CspReportPayload) : null;
    } catch {
      return new NextResponse(null, { status: 204 });
    }
    if (!payload) return new NextResponse(null, { status: 204 });

    const body = pickCspBody(payload);
    if (!body) return new NextResponse(null, { status: 204 });

    // Extract a small, fixed set of fields so we never accidentally store an
    // entire page worth of attacker-controlled data in the audit row.
    const safeMeta = {
      blockedUri: typeof body["blocked-uri"] === "string" ? body["blocked-uri"] : undefined,
      blockedUrl: typeof body["blockedURL"] === "string" ? body["blockedURL"] : undefined,
      documentUri: typeof body["document-uri"] === "string" ? body["document-uri"] : undefined,
      documentUrl: typeof body["documentURL"] === "string" ? body["documentURL"] : undefined,
      effectiveDirective:
        typeof body["effective-directive"] === "string"
          ? body["effective-directive"]
          : typeof body["effectiveDirective"] === "string"
            ? body["effectiveDirective"]
            : undefined,
      violatedDirective:
        typeof body["violated-directive"] === "string"
          ? body["violated-directive"]
          : undefined,
      disposition: typeof body["disposition"] === "string" ? body["disposition"] : undefined,
      statusCode:
        typeof body["status-code"] === "number"
          ? body["status-code"]
          : typeof body["statusCode"] === "number"
            ? body["statusCode"]
            : undefined,
    };

    await auditEvent({
      eventType: "CSP_VIOLATION_REPORTED",
      severity: "warning",
      request: req,
      metadata: safeMeta,
    });
  } catch {
    // Never propagate — this endpoint is fire-and-forget for the browser.
  }
  return new NextResponse(null, { status: 204 });
}
