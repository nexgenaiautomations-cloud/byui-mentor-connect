import { test, expect, type Locator, type Page } from "@playwright/test";

// Every public page's links and buttons go somewhere real, and the auth
// forms give the right feedback. Only non-school emails are submitted, so
// nothing is written to the database and no email is sent.

const PUBLIC_PAGES = ["/", "/login", "/signup", "/forgot-password", "/terms", "/privacy", "/accessibility", "/schools"];
const NOT_A_SCHOOL = "someone@gmail.com";

// Type into a field and make sure the value sticks. Against a busy dev
// server, React can hydrate after the first fill and reset the input.
// Email is filled after passwords: WebKit's password handling can clear an
// email field filled before the password box is focused.
async function fillStable(field: Locator, value: string) {
  await expect(async () => {
    await field.fill(value);
    await field.page().waitForTimeout(150);
    await expect(field).toHaveValue(value, { timeout: 100 });
  }).toPass({ timeout: 15_000 });
}

async function internalHrefs(page: Page): Promise<string[]> {
  const hrefs = await page.locator("a[href]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("href") ?? "")
  );
  return [...new Set(hrefs)].filter((h) => h.startsWith("/") || h.startsWith("#"));
}

test.describe("Public links", () => {
  for (const path of PUBLIC_PAGES) {
    test(`every link on ${path} resolves`, async ({ page, request }) => {
      await page.goto(path);
      for (const href of await internalHrefs(page)) {
        if (href.startsWith("#")) {
          // In-page jump links must have a target.
          if (href.length > 1) await expect(page.locator(href), `${path} → ${href}`).toHaveCount(1);
          continue;
        }
        const res = await request.get(href, { maxRedirects: 0 });
        expect(res.status(), `${path} → ${href}`).toBeLessThan(400);
      }
    });
  }

  test("landing buttons go where they say", async ({ page }) => {
    const cases: [RegExp, RegExp][] = [
      [/^Get started/i, /\/signup$/],
      [/^Create an account/i, /\/signup$/],
      [/^Sign in$/i, /\/login$/],
      [/^For schools$/i, /\/schools$/],
    ];
    for (const [name, url] of cases) {
      await page.goto("/");
      await page.getByRole("link", { name }).first().click();
      await expect(page).toHaveURL(url);
    }
  });

  test("landing nav jumps to its sections", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "section links are hidden on phones by design");
    await page.goto("/");
    for (const [name, id] of [["Why ICAN", "why"], ["Standards", "standards"], ["Inspiration", "what"]]) {
      await page.getByRole("link", { name, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  });

  test("footer links open the policy pages", async ({ page }) => {
    for (const [name, url] of [["Terms", /\/terms$/], ["Privacy", /\/privacy$/], ["Accessibility", /\/accessibility$/]] as const) {
      await page.goto("/");
      await page.locator("footer").getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(url);
    }
  });
});

test.describe("Auth form buttons", () => {
  // Each test waits for networkidle before typing: on a slow first load
  // (dev server, WebKit) React hydration can reset inputs filled too early.

  test("login tabs switch between password and magic link", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Send me a magic link" }).click();
    await expect(page.getByLabel("School email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Sign in with password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });

  test("password sign-in refuses a non-school email with a clear message", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await fillStable(page.getByLabel("Password", { exact: true }), "whatever-password-1");
    await fillStable(page.getByLabel("School email"), NOT_A_SCHOOL);
    await page.locator("form").getByRole("button", { name: /^Sign in/ }).click();
    await expect(page.getByText(/isn't from a school on ICAN/i)).toBeVisible();
  });

  test("magic link refuses a non-school email instead of claiming it was sent", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Send me a magic link" }).click();
    await fillStable(page.getByLabel("School email"), NOT_A_SCHOOL);
    await page.locator("form").getByRole("button", { name: /magic link|send/i }).click();
    await expect(page.getByText(/isn't from a school on ICAN/i)).toBeVisible();
    await expect(page.getByText(/we just sent a sign-in link/i)).toHaveCount(0);
  });

  test("signup catches mismatched passwords before sending", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await fillStable(page.getByLabel("Password", { exact: true }), "abcdefg1");
    await fillStable(page.getByLabel("Confirm password"), "abcdefg2");
    await fillStable(page.getByLabel("School email"), "student@byui.edu");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/Passwords don't match/i)).toBeVisible();
  });

  test("signup refuses a non-school email with a clear message", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await fillStable(page.getByLabel("Password", { exact: true }), "abcdefg1");
    await fillStable(page.getByLabel("Confirm password"), "abcdefg1");
    await fillStable(page.getByLabel("School email"), NOT_A_SCHOOL);
    await page.getByRole("button", { name: "Create account" }).click();
    // Either refusal is correct; repeated test runs from one IP can trip the
    // 5-per-hour signup limit first.
    await expect(
      page.getByText(/isn't from a school on ICAN|Too many sign-up attempts/i)
    ).toBeVisible();
  });

  test("forgot password gives the neutral confirmation", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");
    await fillStable(page.getByLabel("School email"), NOT_A_SCHOOL);
    await page.getByRole("button", { name: /send|reset/i }).click();
    await expect(page.getByText(/If an account exists/i)).toBeVisible();
  });

  test("'School not on ICAN yet?' link opens the schools page", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("link", { name: /Have your school contact us/i }).click();
    await expect(page).toHaveURL(/\/schools$/);
  });
});
