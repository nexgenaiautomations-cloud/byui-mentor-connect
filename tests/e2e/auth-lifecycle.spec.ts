import { test, expect, type Page } from "@playwright/test";

// End-to-end coverage of the password auth lifecycle on the fixture school:
//   1. /signup (email + password) lands on "check your email"
//   2. the account is verified (the e2e stand-in for the emailed link)
//   3. password sign-in reaches the first-run flow; clearing cookies signs out
//   4. sign-up validation and the no-enumeration forgot-password state
//
// Cleanup: after each test, delete the synthetic user from the FIXTURE
// database (E2E_DATABASE_URL — never the app's own DATABASE_URL).
import { neon } from "@neondatabase/serverless";

function uniqueEmail(): string {
  const slug = Math.random().toString(36).slice(2, 10);
  return `e2e-signup-${slug}@e2e-alpha.edu`;
}

async function purgeUser(email: string) {
  const sql = neon(process.env.E2E_DATABASE_URL!);
  await sql(`delete from "user" where email = $1 and email like 'e2e-signup-%@e2e-alpha.edu'`, [email]);
}

async function fillSignup(page: Page, email: string, password: string, confirm = password) {
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirm").fill(confirm);
}

// Stands in for clicking the emailed verification link (delivery is
// log-only in e2e runs). Fixture database only.
async function markVerified(email: string) {
  const sql = neon(process.env.E2E_DATABASE_URL!);
  await sql(`update "user" set email_verified = now() where email = $1 and email like 'e2e-signup-%@e2e-alpha.edu'`, [email]);
}

test.describe("Auth lifecycle: signup → verify → sign-in → sign-out → forgot", () => {
  test("a brand-new student signs up, verifies, signs in and signs out", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Creates an account — desktop run only");
    const email = uniqueEmail();
    const password = "cougars12-e2e";
    try {
      await page.goto("/signup");
      await fillSignup(page, email, password);
      await page.getByRole("button", { name: /Create account/i }).click();
      // New accounts must verify their school email before signing in.
      await page.waitForURL(/\/login\/check-email/, { timeout: 30_000 });

      await markVerified(email);
      await page.goto("/login");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.locator("form button[type=submit]").first().click();
      // First sign-in goes through the notices and profile setup.
      await page.waitForURL(/\/agreements|\/onboarding|\/pledge|\/dashboard/, { timeout: 30_000 });
      const me = await page.request.get("/api/me");
      expect(me.ok()).toBeTruthy();
      expect((await me.json()).user?.email).toBe(email);

      await page.context().clearCookies();
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await purgeUser(email);
    }
  });

  test("signup rejects mismatched and weak passwords", async ({ page }) => {
    await page.goto("/signup");
    await fillSignup(page, uniqueEmail(), "cougars12", "different1");
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page.getByText(/Passwords don.?t match/i)).toBeVisible();

    await fillSignup(page, uniqueEmail(), "nopassword");
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page.getByText(/at least one letter and one number/i).last()).toBeVisible();
  });

  test("forgot-password always shows the same success state", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /Forgot your password/i })).toBeVisible();
    // A nonexistent email still shows success — no account enumeration.
    await page.locator('input[type="email"]').fill("does-not-exist@e2e-alpha.edu");
    await page.getByRole("button", { name: /Send reset link/i }).click();
    await expect(page.getByText(/Check your email/i)).toBeVisible();
  });
});
