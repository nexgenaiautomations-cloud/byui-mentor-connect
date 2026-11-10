import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/session";
import { needsAgreement } from "@/lib/agreements";
import { PLEDGE_ITEMS, needsPledge } from "@/lib/pledge";
import { PledgeForm } from "./pledge-form";

export const metadata: Metadata = {
  title: "The 3-2-1 pledge · ICAN",
};

// Every user signs the 3-2-1 pledge (typing their name) after setting up a
// profile and before using ICAN. Outside the (app) group so the app layout's
// pledge gate can't loop. `?then=mentor` continues to the choose-a-mentor
// step of the new sign-up flow.
export default async function PledgePage({
  searchParams,
}: {
  searchParams: Promise<{ then?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (needsAgreement(user)) redirect("/agreements");
  if (!user.onboardedAt) redirect("/onboarding");
  const { then } = await searchParams;
  const next = then === "mentor" ? "/choose-mentor" : "/dashboard";
  if (!needsPledge(user)) redirect(next);

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || "";

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-brand-light/30 via-white to-white px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Logo size={40} tile />
          <span className="font-brand text-2xl font-semibold tracking-[0.12em] text-plum-800">ICAN</span>
        </div>
        <div className="card">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
            Before you continue
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-plum-800 sm:text-3xl">
            The 3-2-1 pledge
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            ICAN works when you put in the reps. Commit to the 3-2-1 standard, then sign
            with your name.
          </p>
          <ol className="mt-5 space-y-3">
            {PLEDGE_ITEMS.map((item) => (
              <li key={item.count} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand font-display text-lg font-black text-white"
                >
                  {item.count}
                </span>
                <div>
                  <p className="font-display font-bold text-plum-800">
                    <span className="sr-only">{item.count}: </span>
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <PledgeForm expectedName={displayName} next={next} />
          </div>
        </div>
      </div>
    </main>
  );
}
