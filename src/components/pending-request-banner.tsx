import { db } from "@/db/client";
import { requests, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { PendingRequestPopup, type PendingRequest } from "./pending-request-popup";

export async function PendingRequestBanner({ userId }: { userId: string }) {
  const pending = await db
    .select({
      id: requests.id,
      requestedAt: requests.requestedAt,
      message: requests.message,
      menteeId: requests.menteeId,
      menteeName: users.name,
      menteeImage: users.image,
      menteeMajor: users.major,
      menteeSemester: users.semesterLevel,
      menteeExpectedGrad: users.expectedGraduation,
    })
    .from(requests)
    .innerJoin(users, eq(users.id, requests.menteeId))
    .where(and(eq(requests.mentorId, userId), eq(requests.status, "pending")))
    .orderBy(desc(requests.requestedAt))
    .limit(5);

  if (pending.length === 0) return null;

  const data: PendingRequest[] = pending.map((p) => ({
    id: p.id,
    menteeName: p.menteeName,
    menteeImage: p.menteeImage,
    menteeMajor: p.menteeMajor,
    menteeSemester: p.menteeSemester,
    menteeExpectedGrad: p.menteeExpectedGrad,
    message: p.message,
    requestedAt: p.requestedAt.toISOString(),
  }));

  return <PendingRequestPopup requests={data} />;
}
