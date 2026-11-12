import { describe, it, expect } from "vitest";
import {
  appendTranscript,
  getRecognitionCtor,
  suggestAccomplishments,
  dictationErrorMessage,
} from "@/lib/dictation";
import { groupsForRole } from "@/lib/possible-actions";

const menteeLabels = groupsForRole("mentee").flatMap((g) => g.options);
const mentorLabels = groupsForRole("mentor").flatMap((g) => g.options);

describe("getRecognitionCtor", () => {
  it("finds the standard or webkit constructor, or null (Firefox)", () => {
    class R {}
    expect(getRecognitionCtor({ SpeechRecognition: R })).toBe(R);
    expect(getRecognitionCtor({ webkitSpeechRecognition: R })).toBe(R);
    expect(getRecognitionCtor({})).toBeNull();
    expect(getRecognitionCtor(undefined)).toBeNull();
  });
});

describe("appendTranscript", () => {
  it("starts with a capital and joins chunks with a space", () => {
    expect(appendTranscript("", "we reviewed her resume")).toBe("We reviewed her resume");
    expect(appendTranscript("We reviewed her resume", "and cover letter")).toBe("We reviewed her resume and cover letter");
    expect(appendTranscript("Done.", "next we practiced")).toBe("Done. Next we practiced");
  });
  it("ignores empty chunks", () => {
    expect(appendTranscript("Hi", "   ")).toBe("Hi");
  });
});

describe("suggestAccomplishments", () => {
  it("suggests matching labels for the role", () => {
    const s = suggestAccomplishments("We went over his resume and practiced a mock interview", "mentor", mentorLabels);
    expect(s).toEqual(["Helped with resumes", "Helped with interviewing skills"]);
  });
  it("uses mentee wording for mentees", () => {
    expect(suggestAccomplishments("updated my LinkedIn", "mentee", menteeLabels)).toEqual([
      "Updated LinkedIn or another professional platform",
    ]);
  });
  it("never suggests offers the role can't log, and needs explicit offer language", () => {
    expect(suggestAccomplishments("she got an internship offer", "mentor", mentorLabels)).toEqual([]);
    expect(suggestAccomplishments("I got an internship offer!", "mentee", menteeLabels)).toEqual(["I got an internship offer"]);
    expect(suggestAccomplishments("we talked about internships", "mentee", menteeLabels)).toEqual([]);
  });
  it("skips labels already checked and empty text", () => {
    expect(suggestAccomplishments("resume", "mentee", menteeLabels, ["Worked on my resume"])).toEqual([]);
    expect(suggestAccomplishments("  ", "mentee", menteeLabels)).toEqual([]);
  });
});

describe("dictationErrorMessage", () => {
  it("always offers typing as a fallback", () => {
    expect(dictationErrorMessage("not-allowed")).toMatch(/type/);
    expect(dictationErrorMessage("weird")).toMatch(/type/);
    expect(dictationErrorMessage("aborted")).toBe("");
  });
});
