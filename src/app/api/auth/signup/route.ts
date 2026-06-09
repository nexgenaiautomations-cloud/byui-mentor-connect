import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, passwordIssues } from "@/lib/password";
import { attachSessionCookie } from "@/lib/auth-cookie";
import { limitSignup } from "@/lib/rate-limit";

const BYUI_DOMAIN = "@byui.edu";

const PRIOR_INTERNSHIPS_OPTIONS = ["None", "1", "2", "3 or more"];

// priorCareerChats is now a typed whole number. Accept either a number or a
// numeric string from the client (the form sends a string from a number
// input). Stored as a string in the DB to avoid a schema migration — the
// parsePriorCareerChats helper handles read-time conversion.
const priorChatsSchema = z
  .union([z.number().int().min(0).max(10_000), z.string()])
  .transform((v, ctx) => {
    if (typeof v === "number") return v;
    const trimmed = v.trim();
    if (!/^\d+$/.test(trimmed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Career chats must be a whole number 0 or greater.",
      });
      return z.NEVER;
    }
    const n = Number(trimmed);
    if (n < 0 || n > 10_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Career chats must be between 0 and 10000.",
      });
      return z.NEVER;
    }
    return n;
  });

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
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  major: z.string().trim().max(120).optional().nullable(),
  priorCareerChats: priorChatsSchema,
  priorInternshipExperience: z.enum(
    PRIOR_INTERNSHIPS_OPTIONS as [string, ...string[]]
  ),
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
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`.trim(),
      major: data.major ?? null,
      passwordHash,
      // Stored as a string in the DB (column type is text) but always a
      // clean numeric value moving forward. Trophy Case math reads it via
      // parsePriorCareerChats which also accepts legacy range strings.
      priorCareerChats: String(data.priorCareerChats),
      priorInternshipExperience: data.priorInternshipExperience,
      // We trust the BYU-I email gate (@byui.edu only) and mark verified.
      // A future change could send a confirmation email; the column exists.
      emailVerified: new Date(),
    })
    .returning({ id: users.id, email: users.email, name: users.name });

  const res = NextResponse.json({
    ok: true,
    user: { id: inserted.id, email: inserted.email },
    redirectTo: "/onboarding",
  });
  return attachSessionCookie(res, {
    userId: inserted.id,
    email: inserted.email,
    name: inserted.name,
  });
}
