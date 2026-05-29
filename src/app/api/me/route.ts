import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { CAREER_OPTIONS, SEMESTER_LEVELS } from "@/lib/careers";

const profileSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  major: z.string().min(1).max(120),
  minor: z.string().max(120).optional().nullable(),
  semesterLevel: z.enum(SEMESTER_LEVELS as unknown as [string, ...string[]]),
  expectedGraduation: z.string().min(1).max(40),
  phone: z.string().max(40).optional().nullable(),
  preferredContactMethod: z.enum(["email", "phone", "teams"]),
  bio: z.string().max(2000).optional().nullable(),
  // Image URLs must be https:// — no javascript:, data:, or http: tracking
  // pixels. Length cap mitigates header smuggling / log floods.
  image: z
    .string()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//i.test(v), {
      message: "image must be an https:// URL",
    })
    .optional()
    .nullable(),
  careerInterests: z
    .array(z.enum(CAREER_OPTIONS as unknown as [string, ...string[]]))
    .max(CAREER_OPTIONS.length),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
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

  const [updated] = await db
    .update(users)
    .set({
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`,
      major: data.major,
      minor: data.minor ?? null,
      semesterLevel: data.semesterLevel,
      expectedGraduation: data.expectedGraduation,
      phone: data.phone ?? null,
      preferredContactMethod: data.preferredContactMethod,
      bio: data.bio ?? null,
      image: data.image ? data.image : null,
      careerInterests: data.careerInterests,
      onboardedAt: user.onboardedAt ?? new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  return NextResponse.json({ user: updated });
}
