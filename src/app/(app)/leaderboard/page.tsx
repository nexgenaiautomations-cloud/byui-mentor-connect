import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { MAJOR_ACTIVITY_POINTS } from "@/lib/pods";
import { ensureMajorPods, listPods, monthlyLeaderboard } from "@/lib/pods-server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PodControls } from "./pod-controls";

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/Denver" });
}

// /leaderboard — monthly pod standings. Shaun Franklin, 2026-11-09.
export default async function LeaderboardPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  await ensureMajorPods();
  const [{ since, pods }, allPods, [fresh]] = await Promise.all([
    monthlyLeaderboard(me.email),
    listPods(),
    db.select({ podId: users.podId }).from(users).where(eq(users.id, me.id)),
  ]);
  const myPodId = fresh?.podId ?? null;
  const myPod = pods.find((p) => p.id === myPodId) ?? null;
  const myPoints = myPod?.roster.find((m) => m.id === me.id)?.points ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{monthLabel(since)}</p>
        <h1 className="font-display text-2xl font-black text-plum-800 sm:text-3xl">Pod leaderboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Every activity you log earns your pod 1 point. Internship and job offers earn{" "}
          {MAJOR_ACTIVITY_POINTS}. The board resets on the 1st of every month.
        </p>
      </header>

      <PodControls
        pods={allPods}
        myPodId={myPodId}
        isAdmin={me.isAdmin}
      />

      {myPod && (
        <section className="card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-plum-800">Your pod: {myPod.name}</h2>
            <p className="text-sm font-semibold text-slate-700">
              Rank #{myPod.rank} · {myPod.points} pts · you: {myPoints} pts
            </p>
          </div>
          <ol className="mt-3 divide-y divide-slate-100">
            {myPod.roster.map((m, i) => (
              <li key={m.id} className={`flex items-center gap-3 py-2 text-sm ${m.id === me.id ? "font-semibold text-brand-dark" : "text-slate-800"}`}>
                <span className="w-6 text-right text-slate-600">{i + 1}</span>
                <span className="flex-1 truncate">{m.name || "Member"}{m.id === me.id ? " (you)" : ""}</span>
                <span className="tabular-nums">{m.points} pts</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card overflow-hidden p-0">
        <h2 className="px-5 pt-5 font-display text-lg font-bold text-plum-800">All pods</h2>
        {pods.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">
            No pods yet. Pods are created from members&apos; majors once profiles are filled in.
          </p>
        ) : (
          <table className="mt-3 min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="px-5 py-2">Rank</th>
                <th scope="col" className="px-3 py-2">Pod</th>
                <th scope="col" className="px-3 py-2 text-right">Members</th>
                <th scope="col" className="px-5 py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pods.map((p) => (
                <tr key={p.id} className={p.id === myPodId ? "bg-brand-light/20" : ""}>
                  <td className="px-5 py-2.5 font-bold text-plum-800">#{p.rank}</td>
                  <td className="px-3 py-2.5 text-slate-900">
                    {p.name}
                    {p.id === myPodId && <span className="ml-2 text-xs font-semibold text-brand">Your pod</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{p.members}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-slate-900">{p.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
