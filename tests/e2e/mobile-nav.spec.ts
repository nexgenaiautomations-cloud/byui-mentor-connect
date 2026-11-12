import { test, expect } from "@playwright/test";
import { ACCOUNTS, signIn } from "./fixtures";

// Mobile chrome for each role. Runs against the seeded fixture database.
test.describe("Mobile navigation", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === "desktop-chromium", "Mobile-only");
  });

  test("bottom bar shows the member destinations", async ({ page }) => {
    await signIn(page, ACCOUNTS.solo);
    const bottomBar = page.locator("nav.lg\\:hidden.fixed").last();
    await expect(bottomBar).toBeVisible();
    for (const name of [/Home/i, /Find/i, /Activity/i, /Trophies/i]) {
      await expect(bottomBar.getByRole("link", { name })).toBeVisible();
    }
  });

  test("hamburger menu opens a drawer with Sign out, and signing out ends the session", async ({ page }) => {
    await signIn(page, ACCOUNTS.solo);
    await page.getByRole("button", { name: /Open menu/i }).click();
    await expect(page.getByRole("button", { name: /Sign out/i })).toBeVisible();
    // Server-action submits can hang Playwright's click on mobile; submit the
    // form directly instead.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button[type=submit]")).find((b) =>
        /sign out/i.test((b as HTMLButtonElement).innerText)
      ) as HTMLButtonElement | undefined;
      btn?.form?.requestSubmit(btn);
    });
    await page.waitForURL(/\/login|\/$/, { timeout: 30_000 });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test("admin bottom bar shows admin destinations", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin");
    const bottomBar = page.locator("nav.lg\\:hidden.fixed").last();
    for (const name of [/Overview/i, /Members/i, /Review/i, /Matches/i]) {
      await expect(bottomBar.getByRole("link", { name })).toBeVisible();
    }
  });
});
