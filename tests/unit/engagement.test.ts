import { describe, it, expect } from "vitest";
import {
  classifyLegacyLog,
  resolveEventKind,
  computeMatchTimestamps,
  interactionReference,
  isInteraction,
  isMeeting,
  countsTowardMeetings,
} from "@/lib/engagement";

const d = (s: string) => new Date(s);

describe("classifyLegacyLog", () => {
  it("system rows are system events", () => {
    expect(classifyLegacyLog({ isSystemGenerated: true, createdBy: "system", matchId: null, meetingType: "other" })).toBe("system_event");
    expect(classifyLegacyLog({ isSystemGenerated: false, createdBy: "system", matchId: "m", meetingType: "other" })).toBe("system_event");
  });
  it("mentor/admin rows tied to a match are meetings", () => {
    expect(classifyLegacyLog({ isSystemGenerated: false, createdBy: "mentor", matchId: "m", meetingType: "video" })).toBe("mentor_meeting");
    expect(classifyLegacyLog({ isSystemGenerated: false, createdBy: "admin", matchId: "m", meetingType: "other" })).toBe("mentor_meeting");
  });
  it("mentee self-logs without a match are independent", () => {
    expect(classifyLegacyLog({ isSystemGenerated: false, createdBy: "mentee", matchId: null, meetingType: "video" })).toBe("independent_activity");
  });
  it("mentee self-logs auto-attached to a match with the default type are independent", () => {
    expect(classifyLegacyLog({ isSystemGenerated: false, createdBy: "mentee", matchId: "m", meetingType: "other" })).toBe("independent_activity");
  });
  it("ambiguous rows are unverified, never invented meetings", () => {
    expect(classifyLegacyLog({ isSystemGenerated: false, createdBy: "mentee", matchId: "m", meetingType: "in_person" })).toBe("unverified");
    expect(classifyLegacyLog({ isSystemGenerated: false, createdBy: null, matchId: null, meetingType: "video" })).toBe("unverified");
    expect(classifyLegacyLog({ isSystemGenerated: false, createdBy: "mentor", matchId: null, meetingType: "video" })).toBe("unverified");
  });
});

describe("resolveEventKind", () => {
  it("mentor defaults to a meeting, may choose touchpoint", () => {
    expect(resolveEventKind({ path: "mentor", requested: undefined, hasMatch: true })).toBe("mentor_meeting");
    expect(resolveEventKind({ path: "mentor", requested: "touchpoint", hasMatch: true })).toBe("touchpoint");
  });
  it("mentor cannot file an independent activity for the mentee", () => {
    expect(resolveEventKind({ path: "mentor", requested: "independent_activity", hasMatch: true })).toBe("mentor_meeting");
  });
  it("self-log defaults to independent activity", () => {
    expect(resolveEventKind({ path: "self", requested: undefined, hasMatch: true })).toBe("independent_activity");
  });
  it("self-log may claim a meeting only when there is a match", () => {
    expect(resolveEventKind({ path: "self", requested: "mentor_meeting", hasMatch: true })).toBe("mentor_meeting");
    expect(resolveEventKind({ path: "self", requested: "touchpoint", hasMatch: true })).toBe("touchpoint");
    expect(resolveEventKind({ path: "self", requested: "mentor_meeting", hasMatch: false })).toBe("independent_activity");
  });
  it("clients can never create system or unverified rows", () => {
    expect(resolveEventKind({ path: "self", requested: "system_event", hasMatch: true })).toBe("independent_activity");
    expect(resolveEventKind({ path: "mentor", requested: "unverified", hasMatch: true })).toBe("mentor_meeting");
  });
});

describe("kind predicates", () => {
  it("only meetings and touchpoints are interactions", () => {
    expect(isInteraction("mentor_meeting")).toBe(true);
    expect(isInteraction("touchpoint")).toBe(true);
    expect(isInteraction("independent_activity")).toBe(false);
    expect(isInteraction("system_event")).toBe(false);
    expect(isInteraction("unverified")).toBe(false);
    expect(isInteraction(null)).toBe(false);
  });
  it("only mentor_meeting is a meeting", () => {
    expect(isMeeting("mentor_meeting")).toBe(true);
    expect(isMeeting("touchpoint")).toBe(false);
    expect(countsTowardMeetings({ eventKind: "touchpoint" })).toBe(false);
    expect(countsTowardMeetings({ eventKind: "mentor_meeting" })).toBe(true);
  });
});

describe("computeMatchTimestamps", () => {
  it("is all-null with no logs", () => {
    expect(computeMatchTimestamps([], "s")).toEqual({
      firstMeetingAt: null,
      lastMeetingAt: null,
      lastInteractionAt: null,
      lastStudentActivityAt: null,
    });
  });

  it("independent activity does not move interaction timestamps", () => {
    const t = computeMatchTimestamps(
      [
        { eventKind: "mentor_meeting", meetingDate: d("2026-01-05"), studentId: "s" },
        { eventKind: "independent_activity", meetingDate: d("2026-03-01"), studentId: "s" },
        { eventKind: "system_event", meetingDate: d("2026-03-02"), studentId: "s" },
      ],
      "s"
    );
    expect(t.lastInteractionAt).toEqual(d("2026-01-05"));
    expect(t.lastMeetingAt).toEqual(d("2026-01-05"));
    expect(t.lastStudentActivityAt).toEqual(d("2026-03-01"));
  });

  it("touchpoints move interaction but not meeting timestamps", () => {
    const t = computeMatchTimestamps(
      [
        { eventKind: "mentor_meeting", meetingDate: d("2026-02-01"), studentId: "s" },
        { eventKind: "mentor_meeting", meetingDate: d("2026-01-01"), studentId: "s" },
        { eventKind: "touchpoint", meetingDate: d("2026-02-20"), studentId: "s" },
      ],
      "s"
    );
    expect(t.firstMeetingAt).toEqual(d("2026-01-01"));
    expect(t.lastMeetingAt).toEqual(d("2026-02-01"));
    expect(t.lastInteractionAt).toEqual(d("2026-02-20"));
    expect(t.lastStudentActivityAt).toBeNull();
  });

  it("unverified legacy rows count for nothing", () => {
    const t = computeMatchTimestamps(
      [{ eventKind: "unverified", meetingDate: d("2026-02-01"), studentId: "s" }],
      "s"
    );
    expect(t.lastInteractionAt).toBeNull();
    expect(t.firstMeetingAt).toBeNull();
  });

  it("ignores another student's independent activity", () => {
    const t = computeMatchTimestamps(
      [{ eventKind: "independent_activity", meetingDate: d("2026-02-01"), studentId: "other" }],
      "s"
    );
    expect(t.lastStudentActivityAt).toBeNull();
  });
});

describe("interactionReference", () => {
  it("falls back to match start when there has been no interaction", () => {
    expect(interactionReference({ lastInteractionAt: null, startedAt: d("2026-01-01") })).toEqual(d("2026-01-01"));
    expect(interactionReference({ lastInteractionAt: d("2026-02-01"), startedAt: d("2026-01-01") })).toEqual(d("2026-02-01"));
  });
});
