import { describe, it, expect } from "vitest";
import {
  shouldCreateWeeklyAutoLog,
  shouldCreateMonthlyAutoLog,
  WEEKLY_AUTO_LOG_TOPIC,
  MONTHLY_AUTO_LOG_TOPIC,
} from "@/lib/auto-logs";

describe("auto-log decision logic", () => {
  it("creates weekly auto-log only when count reaches goal and none exists", () => {
    // Below threshold
    expect(shouldCreateWeeklyAutoLog(0, false)).toBe(false);
    // At threshold and none exists
    expect(shouldCreateWeeklyAutoLog(1, false)).toBe(true);
    // At threshold but already exists — dedup
    expect(shouldCreateWeeklyAutoLog(1, true)).toBe(false);
    // Above threshold — still dedup (only one per period)
    expect(shouldCreateWeeklyAutoLog(5, true)).toBe(false);
    expect(shouldCreateWeeklyAutoLog(5, false)).toBe(true);
  });

  it("creates monthly auto-log only at 3+ chats with no existing", () => {
    expect(shouldCreateMonthlyAutoLog(0, false)).toBe(false);
    expect(shouldCreateMonthlyAutoLog(2, false)).toBe(false);
    expect(shouldCreateMonthlyAutoLog(3, false)).toBe(true);
    expect(shouldCreateMonthlyAutoLog(3, true)).toBe(false);
    expect(shouldCreateMonthlyAutoLog(5, true)).toBe(false);
  });
});

describe("auto-log topic markers", () => {
  it("uses stable, human-readable topic strings", () => {
    expect(WEEKLY_AUTO_LOG_TOPIC).toBe("Weekly Career Task goal completed");
    expect(MONTHLY_AUTO_LOG_TOPIC).toBe("Monthly Career Chats goal completed");
  });
});
