import { z } from "zod";
import { TERMS_VERSION } from "@/lib/disclaimers";

// Acknowledgments every user checks at profile setup (/agreements), based on
// the disclaimer language BYU-Idaho provided.
export const AGREEMENT_ITEMS = [
  {
    key: "independent",
    label:
      "I understand ICAN Mentor Connect is a third-party service operated by GDW Innovations, LLC. It is not operated or maintained by BYU-Idaho or any other university.",
  },
  {
    key: "optional",
    label:
      "I understand my use of Mentor Connect is voluntary. No class or instructor can require it, and it does not affect my grades or credit.",
  },
  {
    key: "outcomes",
    label:
      "I understand universities do not control the independent actions of mentors or other users, and do not guarantee mentoring, employment, career, educational, or other outcomes.",
  },
  {
    key: "safety",
    label:
      "I will use appropriate judgment when communicating or meeting with other users, and I won't share sensitive personal information that isn't necessary for the program.",
  },
  {
    key: "terms",
    label: "I agree to the Terms of Use and the Privacy Notice.",
  },
] as const;

export type AgreementKey = (typeof AGREEMENT_ITEMS)[number]["key"];

const mustCheck = z.literal(true, {
  errorMap: () => ({ message: "Please check every box to continue." }),
});

export const agreementSchema = z.object({
  independent: mustCheck,
  optional: mustCheck,
  outcomes: mustCheck,
  safety: mustCheck,
  terms: mustCheck,
});

export function needsAgreement(user: { termsAcceptedVersion: string | null }): boolean {
  return user.termsAcceptedVersion !== TERMS_VERSION;
}
