import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { requests, users } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { RequestRow } from "./request-row";

export default async function RequestsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  const rows = await db
    .select({
      id: requests.id,
      status: requests.status,
      requestedAt: requests.requestedAt,
      respondedAt: requests.respondedAt,
      message: requests.message,
      mentorId: requests.mentorId,
      menteeId: requests.menteeId,
      mentorName: users.name,
    })
    .from(requests)
    .leftJoin(users, eq(users.id, requests.mentorId))
    .where(or(eq(requests.mentorId, me.id), eq(requests.menteeId, me.id)))
    .orderBy(desc(requests.requestedAt));

  const incoming = rows.filter((r) => r.mentorId === me.id);
  const outgoing = rows.filter((r) => r.menteeId === me.id);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-3xl font-bold text-navy-800">Requests</h1>
        <p className="mt-1 text-slate-600">Pending mentorship requests, sent and received.</p>
      </header>

      {me.isMentor && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-navy-800">Incoming</h2>
          {incoming.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing pending right now.</p>
          ) : (
            incoming.map((r) => (
              <RequestRow key={r.id} request={r} viewerRole="mentor" />
            ))
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy-800">Outgoing</h2>
        {outgoing.length === 0 ? (
          <p className="text-sm text-slate-500">You haven&apos;t sent any requests yet.</p>
        ) : (
          outgoing.map((r) => (
            <RequestRow key={r.id} request={r} viewerRole="mentee" />
          ))
        )}
      </section>
    </div>
  );
}
