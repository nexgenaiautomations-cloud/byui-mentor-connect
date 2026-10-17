import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders sign-in heading + password/magic toggle", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
    // Password mode is the default; both toggle buttons are present.
    await expect(
      page.getByRole("button", { name: /Sign in with password/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Send me a magic link/i })
    ).toBeVisible();
    // Password form fields visible by default
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Forgot password\?/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Create an account/i })
    ).toBeVisible();
  });

  test("toggling to magic link shows only email + send button", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Send me a magic link/i }).click();
    await expect(
      page.getByRole("button", { name: /Send magic link/i })
    ).toBeVisible();
    // Password input is no longer in the magic-link view
    await expect(page.locator("input[type='password']")).toHaveCount(0);
  });

  test("password sign-in rejects bad credentials", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    // Fill both and confirm both stuck: WebKit on a busy dev server can reset
    // the first field while hydrating.
    const emailBox = page.locator("input[type='email']");
    const passwordBox = page.locator("input[type='password']");
    await expect(async () => {
      await emailBox.fill("nobody@byui.edu");
      await passwordBox.fill("wrongwrong1");
      await page.waitForTimeout(200);
      await expect(emailBox).toHaveValue("nobody@byui.edu", { timeout: 100 });
      await expect(passwordBox).toHaveValue("wrongwrong1", { timeout: 100 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    // Inline error appears under the form
    await expect(
      page.getByText(/email and password don't match|Sign in failed/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("magic-link path rejects a non-school address", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Send me a magic link/i }).click();
    await page.locator("input[type='email']").fill("attacker@gmail.com");
    await page.getByRole("button", { name: /Send magic link/i }).click();
    await expect(page.getByText(/isn't from a school on ICAN/i)).toBeVisible();
  });

  test("captures mobile screenshot", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop-chromium", "desktop covered elsewhere");
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `tests/screenshots/login-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});
