// Voice dictation helpers — pure, framework-free so they can be unit tested.
// The browser's Web Speech API does the recognition; we never record or
// store audio. See docs/specs/accountability-upgrade.md §8.
import { ACTIONS } from "@/lib/possible-actions";

// Minimal structural type for the parts of SpeechRecognition we use. The
// API is prefixed (webkitSpeechRecognition) in Chrome/Safari and missing in
// Firefox, so it's typed loosely and feature-detected at runtime.
export type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
export type RecognitionCtor = new () => RecognitionLike;

export function getRecognitionCtor(win: unknown): RecognitionCtor | null {
  if (!win || typeof win !== "object") return null;
  const w = win as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Join a new final transcript chunk onto the existing text with sensible
// spacing and a capital letter at the start of each new sentence.
export function appendTranscript(existing: string, chunk: string): string {
  const c = chunk.trim();
  if (!c) return existing;
  const base = existing.replace(/\s+$/, "");
  if (!base) return c.charAt(0).toUpperCase() + c.slice(1);
  const endsSentence = /[.!?]$/.test(base);
  const piece = endsSentence ? c.charAt(0).toUpperCase() + c.slice(1) : c;
  return `${base} ${piece}`;
}

export function dictationErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Allow it in your browser settings, or type instead.";
    case "no-speech":
      return "We didn't hear anything. Try again, or type instead.";
    case "audio-capture":
      return "No microphone was found. You can type instead.";
    case "network":
      return "Speech recognition needs an internet connection. You can type instead.";
    case "aborted":
      return "";
    default:
      return "Dictation stopped unexpectedly. You can type instead.";
  }
}

// ---- Checkbox suggestions ----
// Keyword → action key. Deliberately conservative: suggestions are only
// shown as chips the user must click; nothing is checked automatically.
const KEYWORDS: Record<string, RegExp> = {
  resume_work: /\b(resume|résumé|cv)\b/i,
  cover_letter: /\bcover letters?\b/i,
  interview_skills: /\b(interview(ing)? (skills|practice|prep)|practic(e|ed) interview|mock interview)\b/i,
  interview_roleplay: /\brole[- ]?play(ed|ing)?\b/i,
  elevator_pitch: /\belevator pitch\b/i,
  apply_internship: /\b(applied|applying|application)s? (to|for) (an? |the )?(internship|job|position|role)/i,
  linkedin_profile: /\b(linkedin|handshake)\b/i,
  course_planning: /\b(course planning|class schedule|which classes|registration)\b/i,
  grad_school_prep: /\b(grad(uate)? school|gre|gmat|lsat|mcat)\b/i,
  career_event: /\b(career fair|job fair|career event|networking event)\b/i,
  society_meeting: /\b(society meeting|professional society|club meeting)\b/i,
  explore_careers: /\b(explor(e|ed|ing) (careers?|industr(y|ies)|companies))\b/i,
  info_interview_prep: /\b(prep(are|ared|aring)? for (an? )?(informational interview|career chat|coffee chat))\b/i,
  info_interview_done: /\b(had|did|completed) (an? )?(informational interview|career chat|coffee chat)\b/i,
  professional_connection: /\b(connected with|new connection|networking with|introduced (me|him|her|them) to)\b/i,
  internship_offer: /\b(got|received) (an? )?internship offer\b/i,
  part_time_offer: /\b(got|received) (an? )?part[- ]time (job )?offer\b/i,
  full_time_offer: /\b(got|received) (an? )?full[- ]time (job )?offer\b/i,
};

// Returns labels (for the given role) the transcript suggests, excluding
// ones already checked and ones not offered to that role.
export function suggestAccomplishments(
  text: string,
  role: "mentee" | "mentor",
  available: readonly string[],
  alreadyChecked: Iterable<string> = []
): string[] {
  if (!text.trim()) return [];
  const checked = new Set(alreadyChecked);
  const avail = new Set(available);
  const out: string[] = [];
  for (const a of ACTIONS) {
    const re = KEYWORDS[a.key];
    if (!re || !re.test(text)) continue;
    const label = role === "mentor" ? a.mentorLabel : a.menteeLabel;
    if (avail.has(label) && !checked.has(label)) out.push(label);
  }
  return out;
}
