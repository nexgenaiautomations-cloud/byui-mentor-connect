import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// Automated WCAG 2.1 AA checks (accessibility roadmap milestone 4).
// Covers every public page; authenticated surfaces are scanned out-of-band
// with scripts/a11y-scan.mjs (needs a minted session, so it can't run in CI).
// A new violation on any of these pages fails the suite — accessibility
// regressions are defects, not warnings (docs/accessibility/roadmap.md).

const PUBLIC_PAGES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/accessibility",
  "/privacy",
  "/login/check-email?email=student%40byui.edu&purpose=verify",
];

for (const path of PUBLIC_PAGES) {
  test(`WCAG 2.1 AA: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
