import { test, expect } from "@playwright/test";

// CSP smoke tests. The middleware sends ONE of three things based on CSP_MODE:
//   * No CSP header (CSP_MODE=disabled, default in development)
//   * Content-Security-Policy-Report-Only (CSP_MODE=report-only, default in prod)
//   * Content-Security-Policy             (CSP_MODE=enforce)
//
// These tests adapt to whatever the target environment is sending so they
// remain useful against any deploy (production, preview, local). If no CSP
// is sent the suite still verifies the page renders.

test.describe("CSP smoke", () => {
  test("landing renders correctly under whatever CSP mode is active", async ({ page }) => {
    const consoleBlocks: string[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (msg) => {
      const text = msg.text();
      if (/refused to|violates? .*content security|blocked by csp/i.test(text)) {
        consoleBlocks.push(text);
      }
    });

    const resp = await page.goto("/");
    expect(resp).toBeTruthy();
    expect(resp!.status()).toBe(200);
    const enforce = resp!.headers()["content-security-policy"];
    const reportOnly = resp!.headers()["content-security-policy-report-only"];
    const header = enforce ?? reportOnly;

    await page.waitForLoadState("networkidle");
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain("BYUI CAN");
    // No JS-level page errors regardless of CSP mode.
    expect(pageErrors).toEqual([]);

    if (!header) {
      // CSP_MODE=disabled — page should still render fine. Nothing more to check.
      return;
    }

    // Either enforce or report-only — both must carry a nonce, the report-uri,
    // and the two no-effect blockers (clickjacking and Flash).
    expect(header).toContain("nonce-");
    expect(header).toContain("report-uri /api/security/csp-report");
    expect(header).toContain("frame-ancestors 'none'");
    expect(header).toContain("object-src 'none'");

    // In enforce mode, no CSP violations should appear in console. In report-
    // only mode, browsers DO still log violations to the console even when
    // the action wasn't blocked, so we don't fail on those.
    if (enforce && !reportOnly) {
      expect(consoleBlocks).toEqual([]);
    }
  });

  test("login page renders under active CSP mode", async ({ page }) => {
    const resp = await page.goto("/login");
    expect(resp!.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(100);
  });

  test("signup page renders under active CSP mode", async ({ page }) => {
    const resp = await page.goto("/signup");
    expect(resp!.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(100);
  });

  test("CSP report endpoint accepts a legacy report", async ({ request }) => {
    const res = await request.post("/api/security/csp-report", {
      data: { "csp-report": { "blocked-uri": "https://evil.example/x.js", "violated-directive": "script-src" } },
      headers: { "content-type": "application/csp-report" },
    });
    expect(res.status()).toBe(204);
  });

  test("CSP report endpoint silently drops oversized payloads", async ({ request }) => {
    const huge = "x".repeat(30_000);
    const res = await request.post("/api/security/csp-report", {
      data: { junk: huge },
      headers: { "content-type": "application/json" },
    });
    expect(res.status()).toBe(204);
  });
});
