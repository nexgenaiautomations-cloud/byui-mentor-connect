import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders email form + sign-in heading", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
    await expect(page.locator("input[name='email']")).toBeVisible();
    await expect(page.getByRole("button", { name: /Send magic link/i })).toBeVisible();
  });

  test("shows demo login buttons when DEMO_ENABLED is true", async ({ page }) => {
    await page.goto("/login");
    // The seeded demo accounts surface three buttons
    await expect(page.getByRole("button", { name: /Sign in as Admin/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in as Mentor/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in as Member/i })).toBeVisible();
  });

  test("rejects non-@byui.edu address", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name='email']", "attacker@gmail.com");
    await page.getByRole("button", { name: /Send magic link/i }).click();
    // Server action redirects to /login?error=AccessDenied
    await expect(page).toHaveURL(/error=AccessDenied/);
    await expect(page.getByText(/Only @byui\.edu addresses/i)).toBeVisible();
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
