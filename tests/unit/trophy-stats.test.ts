import { describe, it, expect } from "vitest";
import { parsePriorCareerChats } from "@/lib/trophy-stats";

describe("parsePriorCareerChats", () => {
  it("returns 0 for null / undefined / empty", () => {
    expect(parsePriorCareerChats(null)).toBe(0);
    expect(parsePriorCareerChats(undefined)).toBe(0);
    expect(parsePriorCareerChats("")).toBe(0);
    expect(parsePriorCareerChats("   ")).toBe(0);
  });

  it("parses numeric strings as-is", () => {
    expect(parsePriorCareerChats("0")).toBe(0);
    expect(parsePriorCareerChats("5")).toBe(5);
    expect(parsePriorCareerChats("142")).toBe(142);
  });

  it("converts legacy range strings to midpoints", () => {
    expect(parsePriorCareerChats("1-10")).toBe(5);
    expect(parsePriorCareerChats("11-25")).toBe(18);
    expect(parsePriorCareerChats("26-50")).toBe(38);
    expect(parsePriorCareerChats("51-100")).toBe(75);
    expect(parsePriorCareerChats("100+")).toBe(100);
  });

  it("handles generic ranges and +-suffixed strings safely", () => {
    expect(parsePriorCareerChats("10-15")).toBe(13);
    expect(parsePriorCareerChats("200+")).toBe(200);
  });

  it("falls back to 0 on garbage input", () => {
    expect(parsePriorCareerChats("a lot")).toBe(0);
    expect(parsePriorCareerChats("five")).toBe(0);
  });
});
