import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mentorStewardship } from "@/db/schema";

// Remove stewardship links involving this user: as the executive overseeing
// others and/or as the mentor being overseen.
export async function clearStewardshipFor(
  userId: string,
  opts: { asExecutive: boolean; asMentor: boolean }
) {
  if (opts.asExecutive) {
    await db.delete(mentorStewardship).where(eq(mentorStewardship.executiveId, userId));
  }
  if (opts.asMentor) {
    await db.delete(mentorStewardship).where(eq(mentorStewardship.mentorId, userId));
  }
}
