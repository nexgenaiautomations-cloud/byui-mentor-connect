import { db } from "@/db/client";
import { requests, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { PendingRequestActions } from "./pending-request-actions";

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
    .limit(1);

  if (pending.length === 0) return null;
  const p = pending[0];

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl rounded-2xl bg-navy-700 p-4 text-white shadow-lift ring-1 ring-navy-600">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-2.5 w-2.5 shrink-0 translate-y-1.5 animate-pulse rounded-full bg-amber-300" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              p.menteeImage ||
              `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p.menteeName || "")}&backgroundColor=7c3aed&textColor=ffffff`
            }
            alt=""
            className="h-10 w-10 rounded-full object-cover ring-2 ring-white/30"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-200">
              New mentor request
            </p>
            <p className="mt-0.5 font-display text-base font-bold text-white">
              {p.menteeName} wants to be mentored by you
            </p>
            <p className="mt-0.5 truncate text-xs text-navy-100">
              {p.menteeMajor}
              {p.menteeSemester ? ` · ${p.menteeSemester}` : ""}
              {p.menteeExpectedGrad ? ` · grad ${p.menteeExpectedGrad}` : ""}
            </p>
            {p.message && (
              <p className="mt-1 line-clamp-1 text-xs italic text-navy-100">&ldquo;{p.message}&rdquo;</p>
            )}
          </div>
          <PendingRequestActions requestId={p.id} />
        </div>
      </div>
    </div>
  );
}
