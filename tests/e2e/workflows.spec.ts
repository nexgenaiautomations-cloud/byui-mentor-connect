// Core accountability workflows against the seeded fixture database. Runs
// serially: later steps rely on the state earlier ones create.
import { test, expect } from "@playwright/test";
import { ACCOUNTS, signIn, expectNoHorizontalOverflow } from "./fixtures";

test.describe.configure({ mode: "serial" });

test.describe("Accountability workflows", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Writes data — run once, on desktop");
  });

  test("member logs independent activity; dictation falls back to typing when unsupported", async ({ page }) => {
    // Simulate a browser without the Web Speech API (e.g. Firefox).
    await page.addInitScript(() => {
      // @ts-expect-error test-only removal
      delete window.webkitSpeechRecognition;
      // @ts-expect-error test-only removal
      delete window.SpeechRecognition;
    });
    await signIn(page, ACCOUNTS.member, "member");
    await page.goto("/log-meeting");
    await expect(page.getByText(/isn.t available in this browser/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /On my own/ })).toBeChecked();
    await page.getByLabel("Worked on my resume").check();
    await page.getByRole("button", { name: /Log activity/ }).click();
    await page.getByRole("button", { name: /Confirm & Submit/ }).click();
    await expect(page.getByText(/Logged/).first()).toBeVisible({ timeout: 30_000 });
  });

  test("member confirms the mentor's meeting and closes its action items", async ({ page }) => {
    await signIn(page, ACCOUNTS.member, "member");
    await page.goto("/matches");
    const block = page.getByRole("region", { name: "Needs your attention" });
    await expect(block).toBeVisible();
    await block.getByRole("button", { name: "Yes, it happened" }).click();
    await expect(block.getByRole("button", { name: "Yes, it happened" })).toHaveCount(0, { timeout: 30_000 });
    await page.getByRole("button", { name: "Action items done" }).click();
    await expect(page.getByRole("region", { name: "Needs your attention" })).toHaveCount(0, { timeout: 30_000 });
  });

  test("member updates their career stage", async ({ page }) => {
    await signIn(page, ACCOUNTS.member, "member");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Add my status|Update my status/ }).click();
    await page.locator("#cp-stage").selectOption("offer_received");
    await page.getByRole("radio", { name: "Internship" }).check();
    await page.getByRole("button", { name: "Save update" }).click();
    await expect(page.getByRole("heading", { name: "Offer received" })).toBeVisible({ timeout: 30_000 });
  });

  test("mentor logs a touchpoint with a timed next meeting", async ({ page }) => {
    await signIn(page, ACCOUNTS.mentor, "mentor");
    await page.goto("/log-meeting");
    await page.getByRole("radio", { name: /Touchpoint/ }).check();
    await page.getByLabel("Helped with resumes").check();
    await page.locator("#next-date").fill("2031-03-04");
    await page.locator("#next-time").fill("15:30");
    await expect(page.getByText(/an hour before/)).toBeVisible();
    await page.getByRole("button", { name: /Log meeting/ }).click();
    await page.getByRole("button", { name: /Confirm & Submit/ }).click();
    await expect(page.getByText(/Logged/).first()).toBeVisible({ timeout: 30_000 });
  });

  test("admin runs the risk check and records outreach on a case", async ({ page }) => {
    // The beta pair went quiet 90 days ago, but it belongs to the other
    // school: the alpha admin must not get a case for it.
    await signIn(page, ACCOUNTS.betaAdmin);
    await page.goto("/admin/interventions");
    await page.getByRole("button", { name: "Run risk check now" }).click();
    await expect(page.getByText(/Checked \d+ pairs/)).toBeVisible({ timeout: 60_000 });
    await page.reload();
    await expect(page.getByText("Blake Betamember").first()).toBeVisible();
    await page.locator("summary", { hasText: "Manage case" }).first().click();
    await page.getByRole("button", { name: "Record outreach" }).first().click();
    await expect(page.getByText("Outreach recorded")).toBeVisible({ timeout: 30_000 });

    const other = await page.context().browser()!.newContext();
    const alpha = await other.newPage();
    await signIn(alpha, ACCOUNTS.admin);
    await alpha.goto("/admin/interventions?view=all");
    await expect(alpha.locator("body")).not.toContainText("Betamember");
    await other.close();
  });

  test("admin exports CSVs", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    for (const report of ["executive", "effectiveness", "roi"]) {
      const res = await page.request.get(`/api/admin/program-report/csv?report=${report}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/csv");
      const body = await res.text();
      expect(body).toContain("Metric,Value,Notes");
      expect(body).not.toMatch(/@e2e-(alpha|beta)\.edu/); // aggregates only, no emails
    }
  });
});

test.describe("Layouts", () => {
  test("key member and admin pages fit the screen", async ({ page }) => {
    await signIn(page, ACCOUNTS.member, "member");
    for (const path of ["/dashboard", "/log-meeting", "/matches", "/settings"]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
    await page.context().clearCookies();
    await signIn(page, ACCOUNTS.admin);
    for (const path of ["/admin/interventions", "/admin/analytics/executive", "/admin/analytics/effectiveness", "/admin/analytics/careers", "/admin/analytics/roi"]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
  });
});
