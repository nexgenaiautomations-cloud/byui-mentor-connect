import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, requests } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  const myRequests = await db
    .select()
    .from(requests)
    .where(or(eq(requests.menteeId, me.id), eq(requests.mentorId, me.id)));

  const activeMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        or(eq(matches.mentorId, me.id), eq(matches.menteeId, me.id)),
        eq(matches.status, "active")
      )
    );

  const pendingForMe = myRequests.filter((r) => r.status === "pending" && r.mentorId === me.id);
  const sentByMe = myRequests.filter((r) => r.menteeId === me.id);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy-800">
            Hi {me.firstName || "there"}.
          </h1>
          <p className="mt-1 text-slate-600">
            {me.isMentor
              ? "You're a member and an active mentor."
              : "You're a member. Want to mentor too?"}
          </p>
        </div>
        {!me.isMentor && (
          <Link href="/apply-mentor" className="btn-primary">
            Apply to mentor
          </Link>
        )}
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat title="Active matches" value={activeMatches.length} href="/matches" />
        <Stat title="Requests sent" value={sentByMe.length} href="/requests" />
        {me.isMentor ? (
          <Stat title="Pending requests" value={pendingForMe.length} href="/requests" />
        ) : (
          <Stat title="Mentors available" value="Browse" href="/mentors" />
        )}
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-bold text-navy-800">Quick actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link href="/mentors" className="rounded-xl border border-slate-200 p-4 transition hover:border-navy-300 hover:bg-navy-50/40 cursor-pointer">
            <p className="font-semibold text-navy-800">Find a mentor</p>
            <p className="mt-1 text-sm text-slate-600">Filter by major, semester, and career interest.</p>
          </Link>
          <Link href="/requests" className="rounded-xl border border-slate-200 p-4 transition hover:border-navy-300 hover:bg-navy-50/40 cursor-pointer">
            <p className="font-semibold text-navy-800">Review requests</p>
            <p className="mt-1 text-sm text-slate-600">See requests you&apos;ve sent or received.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ title, value, href }: { title: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="card flex flex-col gap-1 transition hover:shadow-lift cursor-pointer">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="font-display text-3xl font-bold text-navy-800">{value}</p>
    </Link>
  );
}
