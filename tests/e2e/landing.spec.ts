import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders headline + CTA + campus photo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Mentor Connect/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Get Started/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign in/i }).first()).toBeVisible();

    // Campus image should load (not a 404)
    const heroImg = page.locator('img[alt="BYU-Idaho campus"]').first();
    await expect(heroImg).toBeVisible();
    const naturalWidth = await heroImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(100);
  });

  test("BYUI CAN rhythm section is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /BYUI CAN rhythm/i })).toBeVisible();
  });

  test("clicking Get Started routes to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Get Started/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("captures mobile screenshot", async ({ page, browserName }, testInfo) => {
    test.skip(testInfo.project.name === "desktop-chromium", "desktop covered elsewhere");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `tests/screenshots/landing-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});
