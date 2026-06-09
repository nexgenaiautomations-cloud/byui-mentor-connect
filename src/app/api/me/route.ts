import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { CAREER_OPTIONS, SEMESTER_LEVELS } from "@/lib/careers";
import { toSafeMe } from "@/lib/safe-user";
import { evaluateAchievementsForStudent } from "@/lib/achievements";

// Everything optional — onboarding lets students skip every field. Server-side
// we just store whatever they send.
const profileSchema = z.object({
  firstName: z.string().max(60).optional().nullable(),
  lastName: z.string().max(60).optional().nullable(),
  major: z.string().max(120).optional().nullable(),
  minor: z.string().max(120).optional().nullable(),
  semesterLevel: z
    .union([
      z.enum(SEMESTER_LEVELS as unknown as [string, ...string[]]),
      z.literal(""),
    ])
    .optional()
    .nullable(),
  expectedGraduation: z.string().max(40).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  preferredContactMethod: z
    .union([z.enum(["email", "phone", "teams"]), z.literal("")])
    .optional()
    .nullable(),
  bio: z.string().max(2000).optional().nullable(),
  // Accepts https:// URLs OR data: URLs from the in-browser file upload
  // (resized to ~256px JPEG, well under the 600KB cap). Rejects http: and
  // javascript: so we don't render attacker-controlled URIs.
  image: z
    .string()
    .max(600_000)
    .refine(
      (v) =>
        v === "" ||
        /^https:\/\//i.test(v) ||
        /^data:image\/(png|jpe?g|webp);base64,/i.test(v),
      { message: "image must be an https:// URL or an uploaded photo" }
    )
    .optional()
    .nullable(),
  careerInterests: z
    .array(z.enum(CAREER_OPTIONS as unknown as [string, ...string[]]))
    .max(CAREER_OPTIONS.length)
    .optional()
    .nullable(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: toSafeMe(user) });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Only overwrite fields the client actually sent — `null` clears, `undefined`
  // leaves the existing value alone. The onboarding form sends every field on
  // every save, so this matters mostly for partial PATCH callers.
  const firstName =
    data.firstName !== undefined ? data.firstName ?? null : user.firstName;
  const lastName =
    data.lastName !== undefined ? data.lastName ?? null : user.lastName;
  const composedName =
    [firstName, lastName].filter((s) => s && s.trim()).join(" ").trim() ||
    user.name;

  const [updated] = await db
    .update(users)
    .set({
      firstName,
      lastName,
      name: composedName,
      major: data.major ?? null,
      minor: data.minor ?? null,
      semesterLevel: data.semesterLevel || null,
      expectedGraduation: data.expectedGraduation ?? null,
      phone: data.phone ?? null,
      preferredContactMethod: data.preferredContactMethod || null,
      bio: data.bio ?? null,
      image: data.image ? data.image : null,
      careerInterests: data.careerInterests ?? [],
      onboardedAt: user.onboardedAt ?? new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  // Re-evaluate achievements — profile_complete can unlock here even with no
  // activity logs. Failure is non-fatal: the user's save still succeeded.
  let newlyEarned: { key: string; title: string; description: string }[] = [];
  try {
    const r = await evaluateAchievementsForStudent(updated.id);
    newlyEarned = r.newlyEarned.map((a) => ({
      key: a.key,
      title: a.title,
      description: a.description,
    }));
  } catch (e) {
    console.error("achievement eval after profile save failed:", e);
  }

  return NextResponse.json({ user: toSafeMe(updated), newlyEarned });
}
