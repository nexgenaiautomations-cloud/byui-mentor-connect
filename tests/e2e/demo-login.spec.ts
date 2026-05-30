import { test, expect } from "@playwright/test";

test.describe("Demo login flow", () => {
  test("sign in as Member → lands on dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Sign in as Member/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
  });

  test("sign in as Mentor → shows pending request banner (seed has 2 pending)", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Sign in as Mentor/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    // Floating gold-ringed banner for the mentor's pending request
    await expect(page.getByText(/New mentor request/i)).toBeVisible({ timeout: 8000 });
  });

  test("sign in as Admin → admin overview reachable", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Sign in as Admin/i }).click();
    await page.waitForURL(/\/dashboard|\/admin/, { timeout: 15000 });

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Admin dashboard/i })).toBeVisible();
  });

  test("captures mobile dashboard screenshot for each role", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop-chromium", "desktop covered elsewhere");

    for (const role of ["Member", "Mentor", "Admin"] as const) {
      await page.goto("/login");
      await page.getByRole("button", { name: new RegExp(`Sign in as ${role}`, "i") }).click();
      await page.waitForURL(/\/dashboard|\/admin/, { timeout: 15000 });
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: `tests/screenshots/dashboard-${role.toLowerCase()}-${testInfo.project.name}.png`,
        fullPage: true,
      });
      // Sign out for next iteration
      await page.context().clearCookies();
    }
  });
});
