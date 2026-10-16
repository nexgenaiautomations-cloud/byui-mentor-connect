import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders ICAN headline + CTA + hero photo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /ICAN/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Get Started/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign in/i }).first()).toBeVisible();

    // Hero image should load (not a 404)
    const heroImg = page.locator('img[src="/hero-students.jpg"]').first();
    await expect(heroImg).toBeVisible();
    const naturalWidth = await heroImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(100);
  });

  test("carries no BYU-Idaho branding, only the non-affiliation notices", async ({ page }) => {
    await page.goto("/");
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/BYUI CAN|BYU-I email/);
    // Every remaining BYU-Idaho mention must be a disclaimer.
    await expect(page.getByText(/not affiliated with or endorsed by BYU-Idaho/i).first()).toBeVisible();
    await expect(page.getByText(/Notice to BYU-Idaho employees/i)).toBeVisible();
    await expect(page.getByText(/does not affect your grades/i).first()).toBeVisible();
    const srcs = await page.locator("img").evaluateAll((els) =>
      els.map((el) => (el as HTMLImageElement).getAttribute("src") ?? "")
    );
    expect(srcs.filter((s) => /byui/i.test(s))).toEqual([]);
  });

  test("clicking Get Started routes to /signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Get Started/i }).first().click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("terms page shows the faculty and student notices", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /Terms of use/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Notice to BYU-Idaho faculty/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Using ICAN is optional/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Assumption of risk/i })).toBeVisible();
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
