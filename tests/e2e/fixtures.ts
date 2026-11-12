import { expect, type Page } from "@playwright/test";

// Accounts created by scripts/seed-e2e.ts (synthetic schools, no real data).
export const ACCOUNTS = {
  admin: "e2e-admin@e2e-alpha.edu",
  exec: "e2e-exec@e2e-alpha.edu",
  mentor: "e2e-mentor@e2e-alpha.edu",
  member: "e2e-member@e2e-alpha.edu",
  solo: "e2e-solo@e2e-alpha.edu",
  betaAdmin: "e2e-beta-admin@e2e-beta.edu",
  betaMember: "e2e-beta-member@e2e-beta.edu",
} as const;

export type Role = "member" | "mentor" | "admin";

// Signs in through the real password form (no test-only backdoor), then
// optionally picks the active role the same way the role switcher does.
export async function signIn(page: Page, email: string, role?: Role) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(process.env.E2E_PASSWORD!);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 60_000 });
  if (role) {
    await page.context().addCookies([{ name: "byui-can-role", value: role, url: page.url() }]);
  }
}

// Fails if the page scrolls sideways (a broken mobile layout).
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}
