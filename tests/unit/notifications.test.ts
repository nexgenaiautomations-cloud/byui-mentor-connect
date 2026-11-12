import { describe, it, expect } from "vitest";
import {
  notificationMode,
  maxPerRun,
  pickInactivityNudge,
  allowedByPreferences,
  dedupe,
  underUserCap,
  NOTIFICATION_KINDS,
} from "@/lib/notifications";
import { buildNotificationEmail } from "@/lib/notification-email";
import { DEFAULT_THRESHOLDS } from "@/lib/program-settings";

const now = new Date("2026-06-01T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const longAgo = new Date("2020-01-01T00:00:00Z");

describe("notificationMode", () => {
  it("is off unless explicitly live or dry run", () => {
    expect(notificationMode(undefined)).toBe("off");
    expect(notificationMode("")).toBe("off");
    expect(notificationMode("true")).toBe("off");
    expect(notificationMode("LIVE")).toBe("live");
    expect(notificationMode("dry-run")).toBe("dry_run");
  });
  it("caps per-run sends", () => {
    expect(maxPerRun(undefined)).toBe(50);
    expect(maxPerRun("10")).toBe(10);
    expect(maxPerRun("-3")).toBe(50);
    expect(maxPerRun("99999")).toBe(500);
  });
});

describe("pickInactivityNudge", () => {
  const t = DEFAULT_THRESHOLDS;
  it("nothing before the first threshold", () => {
    expect(pickInactivityNudge({ startedAt: daysAgo(3), firstMeetingAt: null, lastInteractionAt: null }, t, now, longAgo)).toBeNull();
  });
  it("first-meeting nudge at 7 days only if they never met", () => {
    expect(pickInactivityNudge({ startedAt: daysAgo(8), firstMeetingAt: null, lastInteractionAt: null }, t, now, longAgo)?.kind).toBe(
      "inactivity_first_meeting"
    );
    expect(
      pickInactivityNudge({ startedAt: daysAgo(30), firstMeetingAt: daysAgo(8), lastInteractionAt: daysAgo(8) }, t, now, longAgo)
    ).toBeNull();
  });
  it("escalates to check-in then concern, sending only the highest", () => {
    const m = { startedAt: daysAgo(100), firstMeetingAt: daysAgo(90), lastInteractionAt: daysAgo(15) };
    expect(pickInactivityNudge(m, t, now, longAgo)?.kind).toBe("inactivity_checkin");
    expect(pickInactivityNudge({ ...m, lastInteractionAt: daysAgo(31) }, t, now, longAgo)?.kind).toBe("inactivity_concern");
  });
  it("independent activity is irrelevant — only interaction resets the clock", () => {
    // Facts don't even carry independent activity; the reference is interaction or start.
    const r = pickInactivityNudge({ startedAt: daysAgo(20), firstMeetingAt: null, lastInteractionAt: null }, t, now, longAgo);
    expect(r?.ref).toEqual(daysAgo(20));
  });
  it("backlog guard: crossings before notifications went live are never sent", () => {
    const liveSince = daysAgo(1);
    // crossed 14 days after a 40-day-old interaction → crossed long before liveSince
    expect(
      pickInactivityNudge({ startedAt: daysAgo(100), firstMeetingAt: daysAgo(90), lastInteractionAt: daysAgo(40) }, t, now, liveSince)
    ).toBeNull();
    // crossed the 14-day mark today → after liveSince
    expect(
      pickInactivityNudge(
        { startedAt: daysAgo(100), firstMeetingAt: daysAgo(90), lastInteractionAt: new Date(now.getTime() - 14 * 86400000 + 3600000 * -1) },
        t,
        now,
        liveSince
      )?.kind
    ).toBe("inactivity_checkin");
  });
});

describe("preferences, dedupe and caps", () => {
  it("each kind maps to an opt-out category", () => {
    const off = { meetingReminders: false, followUps: true, inactivityNudges: true };
    expect(allowedByPreferences("meeting_24h", off)).toBe(false);
    expect(allowedByPreferences("log_followup", off)).toBe(true);
    expect(allowedByPreferences("inactivity_concern", null)).toBe(true);
  });
  it("dedupe keys are deterministic and per-recipient", () => {
    expect(dedupe.meeting("meeting_24h", "m1", "u1")).toBe(dedupe.meeting("meeting_24h", "m1", "u1"));
    expect(dedupe.meeting("meeting_24h", "m1", "u1")).not.toBe(dedupe.meeting("meeting_24h", "m1", "u2"));
    const ref = new Date("2026-01-01T00:00:00Z");
    expect(dedupe.inactivity("inactivity_checkin", "x", ref, "u")).toBe("inactivity_checkin:x:2026-01-01T00:00:00.000Z:u");
  });
  it("per-user daily cap", () => {
    expect(underUserCap(2)).toBe(true);
    expect(underUserCap(3)).toBe(false);
  });
});

describe("buildNotificationEmail", () => {
  it("never carries notes, tokens or sensitive content — only a plain link", () => {
    for (const kind of NOTIFICATION_KINDS) {
      const e = buildNotificationEmail(
        kind,
        { appUrl: "https://app.example/", recipientFirstName: "Ana", otherFirstName: "Ben", recipientRole: "mentee", when: "Feb 10 at 3:00 PM MST" },
        "ana@byui.edu"
      );
      expect(e.subject.length).toBeGreaterThan(5);
      expect(e.text).toMatch(/https:\/\/app\.example\/(matches|log-meeting)/);
      expect(e.text).not.toMatch(/[?&](token|code|key)=/i);
      expect(e.html).toContain("/settings");
    }
  });
  it("escapes names in HTML", () => {
    const e = buildNotificationEmail(
      "meeting_1h",
      { appUrl: "https://a", recipientFirstName: "<b>x</b>", otherFirstName: "Ben", recipientRole: "mentor" },
      "a@b.edu"
    );
    expect(e.html).not.toContain("<b>x</b>");
  });
});
