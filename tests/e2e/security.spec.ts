import { test, expect } from "@playwright/test";

test.describe("Security regressions", () => {
  test("/api/cron/inactivity rejects unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/cron/inactivity");
    expect(res.status()).toBe(401);
  });

  test("/api/cron/inactivity rejects wrong bearer token", async ({ request }) => {
    const res = await request.get("/api/cron/inactivity", {
      headers: { authorization: "Bearer not-the-real-secret-9f9f" },
    });
    expect(res.status()).toBe(401);
  });

  test("/api/me returns 401 when unauthenticated", async ({ request }) => {
    const res = await request.get("/api/me");
    expect(res.status()).toBe(401);
  });

  test("/api/matches returns 401 when unauthenticated", async ({ request }) => {
    const res = await request.get("/api/matches");
    expect(res.status()).toBe(401);
  });

  test("/api/mentor-applications POST returns 401 when unauthenticated", async ({ request }) => {
    const res = await request.post("/api/mentor-applications", {
      data: { motivation: "x".repeat(50), topics: ["t"], capacity: 5 },
    });
    expect(res.status()).toBe(401);
  });

  test("/login rejects open-redirect via next=", async ({ page }) => {
    // The form action sanitizes `next` to a relative path before passing to
    // signIn. The page URL legitimately still contains `?next=https://evil.com`
    // (it's the query string of the page we're on); what we care about is
    // that the browser never NAVIGATES TO evil.com.
    await page.goto("/login?next=https://evil.com");
    await page.fill("input[name='email']", "demo@byui.edu");
    const requestPromise = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().includes("/login")
    );
    await page.getByRole("button", { name: /Send magic link/i }).click();
    await requestPromise;
    // Hostname must stay on our origin — never navigate to evil.com.
    const hostname = new URL(page.url()).hostname;
    expect(hostname).not.toContain("evil.com");
  });
});
