import { defineConfig, devices } from "@playwright/test";

// Two modes (see tests/e2e/README.md):
//
// 1. Default — isolated. Playwright starts `next dev` against
//    E2E_DATABASE_URL (a disposable, seeded database). Email delivery is
//    switched to log-only, reminders are off, rate limiting is disabled and
//    the global setup refuses to run unless the database carries the e2e
//    sentinel written by scripts/seed-e2e.ts.
//
// 2. E2E_BASE_URL=https://… — an already-running deployment. Only tests
//    tagged @public run: they read public pages and never sign in, sign up
//    or write data, so they are safe against production.
const external = process.env.E2E_BASE_URL;
const PORT = Number(process.env.E2E_PORT ?? 3100);
const LOCAL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 90_000,
  reporter: [["list"], ["html", { outputFolder: "./tests/e2e-report", open: "never" }]],
  grep: external ? /@public/ : undefined,
  globalSetup: external ? undefined : "./tests/e2e/global-setup.ts",
  use: {
    baseURL: external ?? LOCAL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: external
    ? undefined
    : {
        command: `npx next dev -p ${PORT}`,
        url: `${LOCAL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        env: {
          DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
          // The app never needs owner rights at runtime.
          DATABASE_URL_OWNER: "",
          AUTH_URL: LOCAL,
          EMAIL_TRANSPORT: "log",
          AUTH_RESEND_KEY: "",
          ISSUE_REPORT_TO: "",
          NOTIFICATIONS_MODE: "off",
          CRON_SECRET: "e2e-cron-secret",
          KV_REST_API_URL: "",
          KV_REST_API_TOKEN: "",
          PLATFORM_ADMIN_EMAILS: "",
        },
      },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-pixel-7",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
