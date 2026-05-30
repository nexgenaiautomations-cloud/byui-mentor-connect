import { test, expect } from "@playwright/test";

test.describe("Mobile navigation", () => {
  test.beforeEach(({}, testInfo) => {
    if (testInfo.project.name === "desktop-chromium") {
      test.skip(true, "Mobile-only");
    }
  });

  test("bottom bar shows 4 role-specific items for Member", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Sign in as Member/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Bottom nav should contain Home, Mentors, Requests, Matches
    const bottomBar = page.locator("nav.lg\\:hidden.fixed").last();
    await expect(bottomBar).toBeVisible();
    await expect(bottomBar.getByRole("link", { name: /Home/i })).toBeVisible();
    await expect(bottomBar.getByRole("link", { name: /Mentors/i })).toBeVisible();
    await expect(bottomBar.getByRole("link", { name: /Requests/i })).toBeVisible();
    await expect(bottomBar.getByRole("link", { name: /Matches/i })).toBeVisible();
  });

  test("hamburger menu opens drawer with Sign out", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Sign in as Member/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    await page.getByRole("button", { name: /Open menu/i }).click();

    // Drawer is open — Sign out button visible
    await expect(page.getByRole("button", { name: /Sign out/i })).toBeVisible();
  });

  test("Sign out from drawer clears the session", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Sign in as Member/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    await page.getByRole("button", { name: /Open menu/i }).click();
    // React server-action submits hang Playwright's default click handler
    // on mobile WebKit — submit the form directly instead.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button[type=submit]")).find(
        (b) => /sign out/i.test((b as HTMLButtonElement).innerText)
      ) as HTMLButtonElement | undefined;
      btn?.form?.requestSubmit(btn);
    });

    // Outcome verification: visiting /dashboard now bounces to /login,
    // meaning the session cookie was cleared.
    await page.waitForTimeout(2500);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("mobile bottom bar for Admin shows admin items", async ({ page }, testInfo) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Sign in as Admin/i }).click();
    await page.waitForURL(/\/dashboard|\/admin/, { timeout: 15000 });
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const bottomBar = page.locator("nav.lg\\:hidden.fixed").last();
    await expect(bottomBar.getByRole("link", { name: /Overview/i })).toBeVisible();
    await expect(bottomBar.getByRole("link", { name: /Members/i })).toBeVisible();
    await expect(bottomBar.getByRole("link", { name: /Review/i })).toBeVisible();
    await expect(bottomBar.getByRole("link", { name: /Matches/i })).toBeVisible();

    await page.screenshot({
      path: `tests/screenshots/admin-mobile-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});
