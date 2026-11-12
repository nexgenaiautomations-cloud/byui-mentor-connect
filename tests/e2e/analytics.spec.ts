// Analytics navigation, filters and accessibility (axe) on the admin views.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ACCOUNTS, signIn } from "./fixtures";

const VIEWS = [
  { tab: "Executive summary", path: "/admin/analytics/executive", heading: "Executive summary" },
  { tab: "Program effectiveness", path: "/admin/analytics/effectiveness", heading: "Program effectiveness" },
  { tab: "Career outcomes", path: "/admin/analytics/careers", heading: "Career outcomes" },
  { tab: "ROI", path: "/admin/analytics/roi", heading: "Program ROI" },
];

test.describe("Analytics", () => {
  test("tabs navigate between every analytics view", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin/analytics");
    for (const v of VIEWS) {
      await page.getByRole("navigation", { name: "Analytics views" }).getByRole("link", { name: v.tab }).click();
      await expect(page).toHaveURL(new RegExp(v.path));
      await expect(page.getByRole("heading", { level: 1, name: v.heading })).toBeVisible();
    }
  });

  test("filters apply through the URL and survive a reload", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin/analytics/effectiveness");
    await page.getByLabel("Department").selectOption("Accounting");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/department=Accounting/);
    await page.reload();
    await expect(page.getByLabel("Department")).toHaveValue("Accounting");
  });

  for (const v of VIEWS) {
    test(`no serious accessibility violations on ${v.heading}`, async ({ page }) => {
      await signIn(page, ACCOUNTS.admin);
      await page.goto(v.path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
      expect(serious.map((x) => `${x.id}: ${x.nodes.length}`)).toEqual([]);
    });
  }
});
