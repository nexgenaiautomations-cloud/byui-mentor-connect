// One-shot WCAG 2.1 AA scan of the deployed app with axe-core.
// Usage: node scripts/a11y-scan.mjs [baseUrl]
// Reads AUTH_SECRET from .env.local to mint a session cookie for the
// a11y-audit-test-user row (create/delete it around the run).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { encode } from "next-auth/jwt";

const BASE = process.argv[2] ?? "https://www.byuican.com";
const COOKIE = "__Secure-authjs.session-token";

const PUBLIC_PAGES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/accessibility",
  "/privacy",
  "/login/check-email?email=a11y-audit-test%40byui.edu&purpose=verify",
  "/login/verify", // incomplete-link error state
];
const AUTH_PAGES = [
  "/dashboard",
  "/mentors",
  "/matches",
  "/log-meeting",
  "/check-in",
  "/trophy-case",
  "/profile",
  "/settings",
  "/apply-mentor",
  "/admin",
  "/admin/members",
  "/admin/mentors",
  "/admin/matches",
  "/admin/matchmaker",
  "/admin/applications",
  "/admin/meetings",
  "/admin/analytics",
  "/admin/activity",
  "/admin/audit",
  "/admin/admins",
];

const token = await encode({
  token: {
    sub: "a11y-audit-test-user",
    email: "a11y-audit-test@byui.edu",
    name: "A11y Audit",
  },
  secret: process.env.AUTH_SECRET,
  salt: COOKIE,
  maxAge: 60 * 60, // 1h is plenty
});

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies([
  {
    name: COOKIE,
    value: token,
    domain: "www.byuican.com",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  },
]);

const results = [];
async function scan(page, path) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const v = axe.violations.map((x) => ({
    id: x.id,
    impact: x.impact,
    help: x.help,
    nodes: x.nodes.length,
    sample: x.nodes[0]?.target?.join(" ") ?? "",
  }));
  results.push({ path, finalUrl: page.url().replace(BASE, ""), violations: v });
  console.error(`${path} -> ${v.length} violation types`);
}

const pubCtx = await browser.newContext(); // no cookie: true public view
const pubPage = await pubCtx.newPage();
for (const p of PUBLIC_PAGES) await scan(pubPage, p);
const authPage = await ctx.newPage();
for (const p of AUTH_PAGES) await scan(authPage, p);

await browser.close();
console.log(JSON.stringify(results, null, 1));
