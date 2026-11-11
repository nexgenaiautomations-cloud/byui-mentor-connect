import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadStewardship } from "@/lib/stewardship-server";
import { StewardshipBoard } from "./board";

// /admin/stewardship — assign mentors to executive mentors by dragging them
// between columns. Shaun Franklin, 2026-11-09.
export default async function StewardshipPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const { executives, mentors, current } = await loadStewardship();

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">Executive mentors</p>
        <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Stewardship</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Each executive mentor oversees a group of mentors. Drag mentors between columns (or use
          the Move menu on each card), use <strong>Suggest balance</strong> for an even split, adjust
          it, then <strong>Approve &amp; save</strong>. Nothing changes until you save. Make someone an
          executive mentor from the role button on the Members or Mentors page.
        </p>
      </header>
      {executives.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-800">No executive mentors yet.</p>
          <p className="mt-1 text-sm text-slate-600">
            Open the Mentors page and use the role button on a mentor to make them an executive mentor.
          </p>
        </div>
      ) : (
        <StewardshipBoard executives={executives} mentors={mentors} initial={current} />
      )}
    </div>
  );
}
