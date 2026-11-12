import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/reminder-job", () => ({
  runReminderJob: vi.fn().mockResolvedValue({ mode: "off", liveSince: null, markedMissed: 0, markedCompleted: 0, candidates: 0, outcomes: null }),
}));

import { isAuthorizedCron } from "@/lib/cron-auth";
import { GET } from "@/app/api/cron/reminders/route";
import { runReminderJob } from "@/lib/reminder-job";

const req = (auth?: string) => new Request("https://x/api/cron/reminders", { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(runReminderJob).mockClear();
});

describe("isAuthorizedCron", () => {
  it("refuses everything when the secret is missing", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(isAuthorizedCron(req("Bearer "), "t", "")).toBe(false);
    expect(isAuthorizedCron(req("Bearer undefined"), "t", undefined)).toBe(false);
    err.mockRestore();
  });
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCron(req("Bearer s3cret"), "t", "s3cret")).toBe(true);
    expect(isAuthorizedCron(req("Bearer s3cre"), "t", "s3cret")).toBe(false);
    expect(isAuthorizedCron(req("s3cret"), "t", "s3cret")).toBe(false);
    expect(isAuthorizedCron(req(), "t", "s3cret")).toBe(false);
  });
});

describe("GET /api/cron/reminders", () => {
  it("401s without the secret and never runs the job", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(req("Bearer nope"));
    expect(res.status).toBe(401);
    expect(runReminderJob).not.toHaveBeenCalled();
  });
  it("runs the job with the secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(runReminderJob).toHaveBeenCalledOnce();
  });
});
