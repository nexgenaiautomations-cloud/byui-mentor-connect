// Replaces the old demo-login spec (those "Sign in as …" buttons were
// removed). Signs in through the real password form with seeded fixture
// accounts and checks what each role can and cannot reach.
import { test, expect } from "@playwright/test";
import { ACCOUNTS, signIn } from "./fixtures";

test.describe("Roles and authorization", () => {
  test("member lands on their dashboard with the career journey card", async ({ page }) => {
    await signIn(page, ACCOUNTS.member, "member");
    await page.goto("/dashboard");
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Where are you in your search|Exploring|Interviewing|Actively applying/ })).toBeVisible();
  });

  test("member cannot open admin pages, even with a forged role cookie", async ({ page, context }) => {
    await signIn(page, ACCOUNTS.member);
    await context.addCookies([{ name: "byui-can-role", value: "admin", url: page.url() }]);
    for (const path of ["/admin", "/admin/members", "/admin/interventions", "/admin/analytics/executive"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(new RegExp(`${path}$`));
    }
    const api = await page.request.get("/api/admin/reports/csv");
    expect(api.status()).toBe(403);
  });

  test("mentor sees their mentees and the meeting logger", async ({ page }) => {
    await signIn(page, ACCOUNTS.mentor, "mentor");
    await page.goto("/matches");
    await expect(page.getByText("Riley Member").first()).toBeVisible();
    await page.goto("/log-meeting");
    await expect(page.getByRole("radio", { name: /Meeting/ })).toBeChecked();
  });

  test("executive mentor is a mentor, not an admin", async ({ page }) => {
    await signIn(page, ACCOUNTS.exec, "mentor");
    await page.goto("/admin/interventions");
    await expect(page).not.toHaveURL(/\/admin\/interventions$/);
  });

  test("admin reaches the overview and the new admin areas", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Admin dashboard/i })).toBeVisible();
    await page.goto("/admin/interventions");
    await expect(page.getByRole("heading", { name: "Intervention Center" })).toBeVisible();
  });

  test("an admin never sees the other fixture school", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    for (const path of ["/admin/members", "/admin/matches", "/admin/analytics/executive"]) {
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText("e2e-beta.edu");
      await expect(page.locator("body")).not.toContainText("Betamember");
    }
    const csv = await (await page.request.get("/api/admin/reports/csv?range=all")).text();
    expect(csv).not.toContain("e2e-beta.edu");
    expect(csv).toContain("e2e-alpha.edu");
  });
});
