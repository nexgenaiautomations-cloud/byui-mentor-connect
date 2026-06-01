import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { requests, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";
import { RequestRow } from "./request-row";
import { IncomingRequestCard, type IncomingRequest } from "./incoming-request-card";
import { computeOverlap } from "@/lib/overlap";

export default async function RequestsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");
  // This page is the mentor's incoming-request inbox. Members manage their
  // own outgoing requests from the "My Mentors" page; admins have dedicated
  // /admin/* surfaces.
  if (!me.isMentor) redirect(me.isAdmin ? "/admin" : "/matches");

  const mentee = alias(users, "mentee_u");

  const rows = await db
    .select({
      id: requests.id,
      status: requests.status,
      requestedAt: requests.requestedAt,
      respondedAt: requests.respondedAt,
      message: requests.message,
      mentorId: requests.mentorId,
      menteeId: requests.menteeId,
      menteeName: mentee.name,
      menteeImage: mentee.image,
      menteeMajor: mentee.major,
      menteeMinor: mentee.minor,
      menteeSemesterLevel: mentee.semesterLevel,
      menteeExpectedGraduation: mentee.expectedGraduation,
      menteeBio: mentee.bio,
      menteeCareerInterests: mentee.careerInterests,
    })
    .from(requests)
    .leftJoin(mentee, eq(mentee.id, requests.menteeId))
    .where(eq(requests.mentorId, me.id))
    .orderBy(desc(requests.requestedAt));

  // Decorate incoming with overlap + sort pending by overlap score so the
  // strongest fits are reviewed first.
  const incomingDecorated = rows.map((r) => {
    const overlap = computeOverlap({
      mentor: {
        major: me.major,
        minor: me.minor,
        semesterLevel: me.semesterLevel,
        careerInterests: me.careerInterests,
        mentorTopics: me.mentorTopics,
      },
      mentee: {
        major: r.menteeMajor,
        minor: r.menteeMinor,
        semesterLevel: r.menteeSemesterLevel,
        careerInterests: r.menteeCareerInterests,
      },
    });
    return { row: r, overlap };
  });

  const incomingPending = incomingDecorated
    .filter((x) => x.row.status === "pending")
    .sort((a, b) => b.overlap.score - a.overlap.score);
  const incomingHistory = incomingDecorated.filter((x) => x.row.status !== "pending");

  // Summary tiles — only Pending + Accepted per spec.
  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    accepted: rows.filter((r) => r.status === "accepted").length,
  };

  // History rows render with the lightweight RequestRow.
  const historyRows = incomingHistory.map((x) => ({
    id: x.row.id,
    status: x.row.status,
    requestedAt: x.row.requestedAt,
    message: x.row.message,
    mentorName: null,
  }));

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-2xl font-black text-navy-800 sm:text-3xl lg:text-4xl">Requests.</h1>
        <p className="mt-1 text-sm text-slate-600">
          Incoming requests from students who want you to mentor them.
        </p>
      </header>

      {/* Summary tiles — Pending + Accepted only */}
      <section className="grid grid-cols-2 gap-3 md:max-w-md">
        <StatTile label="Pending"  value={counts.pending}  tone="navy"    />
        <StatTile label="Accepted" value={counts.accepted} tone="emerald" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy-800">Pending review</h2>
        {incomingPending.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing pending right now.</p>
        ) : (
          incomingPending.map(({ row, overlap }) => {
            const card: IncomingRequest = {
              id: row.id,
              requestedAt: row.requestedAt.toISOString(),
              message: row.message,
              mentee: {
                name: row.menteeName,
                image: row.menteeImage,
                major: row.menteeMajor,
                minor: row.menteeMinor,
                semesterLevel: row.menteeSemesterLevel,
                expectedGraduation: row.menteeExpectedGraduation,
                bio: row.menteeBio,
                careerInterests: row.menteeCareerInterests,
              },
              overlap: {
                sameMajor: overlap.sameMajor,
                sameMinor: overlap.sameMinor,
                sharedInterests: overlap.sharedInterests,
                topicsHittingInterests: overlap.topicsHittingInterests,
              },
            };
            return <IncomingRequestCard key={row.id} request={card} />;
          })
        )}
      </section>

      {historyRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-navy-800">History</h2>
          {historyRows.map((r) => (
            <RequestRow key={r.id} request={r} viewerRole="mentor" />
          ))}
        </section>
      )}
    </div>
  );
}
