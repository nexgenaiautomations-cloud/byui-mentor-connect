import { z } from "zod";
import { TERMS_VERSION } from "@/lib/disclaimers";

// Acknowledgments every user checks at profile setup (/agreements). Each
// maps to one of the notices BYU-Idaho asked for.
export const AGREEMENT_ITEMS = [
  {
    key: "independent",
    label:
      "I understand ICAN is an independent, third-party website. It is not owned, operated, sponsored, or endorsed by BYU-Idaho.",
  },
  {
    key: "optional",
    label:
      "I understand using ICAN is optional. No class or instructor can require it, and it does not affect my grades or credit.",
  },
  {
    key: "ownRisk",
    label:
      "I choose to use ICAN at my own risk, including any meetings or advice from other students.",
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
  ownRisk: mustCheck,
  terms: mustCheck,
});

export function needsAgreement(user: { termsAcceptedVersion: string | null }): boolean {
  return user.termsAcceptedVersion !== TERMS_VERSION;
}
