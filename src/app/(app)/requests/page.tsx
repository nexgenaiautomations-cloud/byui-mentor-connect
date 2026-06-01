import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { requests, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";
import { RequestRow } from "./request-row";
import { IncomingRequestCard, type IncomingRequest } from "./incoming-request-card";
import { EmptyState } from "@/components/empty-state";
import { computeOverlap } from "@/lib/overlap";

export default async function RequestsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  const mentor = alias(users, "mentor_u");
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
      mentorName: mentor.name,
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
    .leftJoin(mentor, eq(mentor.id, requests.mentorId))
    .leftJoin(mentee, eq(mentee.id, requests.menteeId))
    .where(or(eq(requests.mentorId, me.id), eq(requests.menteeId, me.id)))
    .orderBy(desc(requests.requestedAt));

  const incomingRaw = rows.filter((r) => r.mentorId === me.id);
  const outgoing = rows.filter((r) => r.menteeId === me.id);

  // Decorate incoming with overlap + sort pending by overlap score so the
  // strongest fits are reviewed first.
  const incomingDecorated = incomingRaw.map((r) => {
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

  // Status counters for the 2x2 grid up top
  const visible = me.isMentor ? rows : outgoing;
  const counts = {
    pending: visible.filter((r) => r.status === "pending").length,
    accepted: visible.filter((r) => r.status === "accepted").length,
    declined: visible.filter((r) => r.status === "declined").length,
    cancelled: visible.filter((r) => r.status === "cancelled").length,
  };

  // History rows are shown with the original lightweight RequestRow — keep
  // it accepting the same shape it already did.
  const historyRows = incomingHistory.map((x) => ({
    id: x.row.id,
    status: x.row.status,
    requestedAt: x.row.requestedAt,
    message: x.row.message,
    mentorName: x.row.mentorName,
  }));

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-2xl font-black text-navy-800 sm:text-3xl lg:text-4xl">Requests.</h1>
        <p className="mt-1 text-sm text-slate-600">
          {me.isMentor ? "Incoming requests and the ones you've sent." : "Where you stand with every mentor you've reached out to."}
        </p>
      </header>

      {/* 4-tile status counter row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Pending"   value={counts.pending}   tone="amber"   />
        <StatTile label="Accepted"  value={counts.accepted}  tone="emerald" />
        <StatTile label="Declined"  value={counts.declined}  tone="slate"   />
        <StatTile label="Cancelled" value={counts.cancelled} tone="slate"   />
      </section>

      {me.isMentor && (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-navy-800">
              Incoming · pending review
            </h2>
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
              <h2 className="font-display text-lg font-bold text-navy-800">
                Incoming · history
              </h2>
              {historyRows.map((r) => (
                <RequestRow key={r.id} request={r} viewerRole="mentor" />
              ))}
            </section>
          )}
        </>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy-800">Outgoing</h2>
        {outgoing.length === 0 ? (
          <EmptyState
            kind="request"
            title="No requests sent yet"
            message="Browse mentors and send your first. A short, specific note doubles your accept rate."
            cta={{ label: "Find a mentor", href: "/mentors" }}
          />
        ) : (
          outgoing.map((r) => (
            <RequestRow key={r.id} request={r} viewerRole="mentee" />
          ))
        )}
      </section>
    </div>
  );
}
