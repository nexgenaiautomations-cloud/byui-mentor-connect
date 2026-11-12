import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationPreferences } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { DEFAULT_PREFERENCES } from "@/lib/notifications";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/schedule";

const schema = z.object({
  meetingReminders: z.boolean(),
  followUps: z.boolean(),
  inactivityNudges: z.boolean(),
  timezone: z.string().max(64).refine((tz) => isValidTimeZone(tz), "Unknown time zone"),
});

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, me.id))
    .limit(1);
  return NextResponse.json({
    preferences: row
      ? {
          meetingReminders: row.meetingReminders,
          followUps: row.followUps,
          inactivityNudges: row.inactivityNudges,
          timezone: row.timezone,
        }
      : { ...DEFAULT_PREFERENCES, timezone: DEFAULT_TIME_ZONE },
  });
}

export async function PUT(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const v = parsed.data;
  await db
    .insert(notificationPreferences)
    .values({ userId: me.id, ...v })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { ...v, updatedAt: new Date() },
    });
  return NextResponse.json({ preferences: v });
}
