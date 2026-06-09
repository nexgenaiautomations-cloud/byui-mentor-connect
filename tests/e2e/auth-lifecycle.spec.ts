import { test, expect, type Page } from "@playwright/test";

// End-to-end coverage of the password auth lifecycle:
//   1. /signup with a fresh @byui.edu email, password, profile basics, and
//      the two prior-experience answers
//   2. Confirms the redirect into /onboarding (or /dashboard if already done)
//   3. Signs out + signs back in via password on /login
//   4. Walks /forgot-password and confirms the success state
//
// Cleanup: after each test, DELETE the synthetic user row directly via SQL so
// the suite stays repeatable. Requires DATABASE_URL in env (provided by
// .env.local during local runs).
import { db } from "../../src/db/client";
import { users } from "../../src/db/schema";
import { eq } from "drizzle-orm";

function uniqueEmail(): string {
  const slug = Math.random().toString(36).slice(2, 10);
  return `e2e.${slug}@byui.edu`;
}

async function purgeUser(email: string) {
  await db.delete(users).where(eq(users.email, email));
}

async function fillSignup(page: Page, email: string, password: string) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('#firstName').fill("E2e");
  await page.locator('#lastName').fill("Tester");
  await page.locator('#password').fill(password);
  await page.locator('#confirm').fill(password);
  await page.locator('#prior-chats').selectOption("0");
  await page.locator('#prior-intern').selectOption("None");
}

test.describe("Auth lifecycle: signup → sign-out → sign-in → forgot", () => {
  test("a brand-new student can sign up, sign out, and sign back in", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = "cougars12-byui";
    try {
      // ---- 1. Signup ----
      await page.goto("/signup");
      await expect(
        page.getByRole("heading", { name: /Create your account/i })
      ).toBeVisible();
      await fillSignup(page, email, password);
      await page.getByRole("button", { name: /Create account/i }).click();
      // Redirect lands at /onboarding (or /dashboard if onboarding skipped).
      await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 10000 });

      // ---- 2. Confirm we're authenticated ----
      const meRes = await page.request.get("/api/me");
      expect(meRes.ok()).toBeTruthy();
      const body = await meRes.json();
      expect(body.user?.email).toBe(email);

      // ---- 3. Sign out (via the settings page form action) ----
      await page.goto("/settings");
      await page.getByRole("button", { name: /Sign out/i }).click();
      await page.waitForURL(/\/login|\//, { timeout: 10000 });

      // ---- 4. Sign back in with the password ----
      await page.goto("/login");
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.getByRole("button", { name: /^Sign in$/ }).click();
      await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 10000 });

      const me2 = await page.request.get("/api/me");
      expect(me2.ok()).toBeTruthy();
      const body2 = await me2.json();
      expect(body2.user?.email).toBe(email);
    } finally {
      await purgeUser(email);
    }
  });

  test("signup rejects mismatched passwords and weak passwords", async ({
    page,
  }) => {
    await page.goto("/signup");
    await fillSignup(page, uniqueEmail(), "cougars12");
    // Break the confirm field
    await page.locator('#confirm').fill("different1");
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(page.getByText(/Passwords don.?t match/i)).toBeVisible();

    // Now make them match but weak (no number)
    await page.locator('#password').fill("nopassword");
    await page.locator('#confirm').fill("nopassword");
    await page.getByRole("button", { name: /Create account/i }).click();
    await expect(
      page.getByText(/at least one letter and one number/i)
    ).toBeVisible();
  });

  test("forgot-password always shows the same success state", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await expect(
      page.getByRole("heading", { name: /Forgot your password/i })
    ).toBeVisible();

    // A nonexistent email should still show the success message — no
    // enumeration.
    await page.locator('input[type="email"]').fill("does-not-exist@byui.edu");
    await page.getByRole("button", { name: /Send reset link/i }).click();
    await expect(page.getByText(/Check your email/i)).toBeVisible();
  });
});
