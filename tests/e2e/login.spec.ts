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

  test("shows demo login buttons when DEMO_ENABLED is true", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Sign in as Admin/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in as Mentor/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in as Member/i })).toBeVisible();
  });

  test("password sign-in rejects bad credentials", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type='email']").fill("nobody@byui.edu");
    await page.locator("input[type='password']").fill("wrongwrong1");
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    // Inline error appears under the form
    await expect(
      page.getByText(/email and password don't match|Sign in failed/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("magic-link path rejects non-@byui.edu address", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Send me a magic link/i }).click();
    await page.locator("input[type='email']").fill("attacker@gmail.com");
    await page.getByRole("button", { name: /Send magic link/i }).click();
    await expect(page.getByText(/Only @byui\.edu/i)).toBeVisible();
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
