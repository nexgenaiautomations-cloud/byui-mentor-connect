import { z } from "zod";

// Signup only collects what's strictly needed to provision the account:
// email + password. The school-domain check runs in the route against the
// `school_domain` table, and the disclaimers are acknowledged at profile
// setup (/agreements) before anything else is collected.
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});
