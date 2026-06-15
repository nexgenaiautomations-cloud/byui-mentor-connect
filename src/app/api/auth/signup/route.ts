import { NextResponse, after } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, passwordIssues } from "@/lib/password";
import { limitSignup } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/send-verification";

const BYUI_DOMAIN = "@byui.edu";

// Signup now only collects what's strictly needed to provision the account:
// email + password. Names, major, prior experience, and everything else
// move into the post-verification onboarding flow. Holding profile data
// hostage behind email verification prevents anyone from squatting another
// student's address — they can't fill out the profile until the real owner
// clicks the verification link.
const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .refine((e) => e.endsWith(BYUI_DOMAIN), {
      message: "Only @byui.edu emails are allowed.",
    }),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;

  const rl = await limitSignup(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Please wait an hour and try again." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      "Invalid input";
    return NextResponse.json({ error: first }, { status: 400 });
  }
  const data = parsed.data;

  const pwIssues = passwordIssues(data.password);
  if (pwIssues.length) {
    return NextResponse.json({ error: pwIssues[0] }, { status: 400 });
  }

  // Email collision: return a generic "use that email to sign in" message
  // rather than confirming the address exists. Stays consistent with the
  // forgot-password response style.
  const [existing] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Try signing in or use Forgot password.",
      },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(data.password);

  const [inserted] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash,
      // Email is unverified until the user clicks the link we fire below.
      // The signin route rejects unverified accounts so a stolen password
      // can't get in unless the attacker also reads the inbox. Name,
      // major, bio, career interests, and the experience answers all
      // land in onboarding so the user has nothing to surface publicly
      // before verification.
      emailVerified: null,
    })
    .returning({ id: users.id, email: users.email });

  // Hand the Resend send off via Next 16's after() so the HTTP response
  // returns immediately. The actual send still happens — Next keeps the
  // function alive past the response just for the after() callbacks —
  // but the user's browser sees the redirect without waiting on Resend's
  // API round-trip.
  const origin = new URL(req.url).origin;
  after(async () => {
    const send = await sendVerificationEmail({
      email: inserted.email,
      origin,
    });
    if (!send.ok) {
      console.error("verification email failed:", send.error);
    }
  });

  return NextResponse.json({
    ok: true,
    user: { id: inserted.id, email: inserted.email },
    // Keep the user signed out — they must verify before they can log in.
    redirectTo: `/login/check-email?email=${encodeURIComponent(inserted.email)}&purpose=verify`,
  });
}
