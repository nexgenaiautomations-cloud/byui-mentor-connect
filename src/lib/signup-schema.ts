import { z } from "zod";

const BYUI_DOMAIN = "@byui.edu";

// Signup only collects what's strictly needed to provision the account:
// email + password + agreement to the Terms of Use (which carries the
// independence / voluntary-use disclaimers). Names, major, prior experience,
// and everything else move into the post-verification onboarding flow.
export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .refine((e) => e.endsWith(BYUI_DOMAIN), {
      message: "Only @byui.edu emails are allowed.",
    }),
  password: z.string().min(8).max(200),
  acceptTerms: z.literal(true, {
    errorMap: () => ({
      message: "Please agree to the Terms of Use and Privacy Notice to continue.",
    }),
  }),
});
