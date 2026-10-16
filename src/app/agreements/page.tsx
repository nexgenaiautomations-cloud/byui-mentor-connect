import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/session";
import { needsAgreement } from "@/lib/agreements";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { EMPLOYEE_NOTICE } from "@/lib/disclaimers";
import { AgreementForm } from "./agreement-form";

export const metadata: Metadata = {
  title: "Before you start — ICAN",
};

// First stop after verifying an account (and for existing users whenever
// TERMS_VERSION changes): the user checks each disclaimer before setting up
// a profile. Lives outside the (app) group so the gate there can't loop.
export default async function AgreementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!needsAgreement(user)) {
    redirect(user.onboardedAt ? "/dashboard" : isPlatformAdmin(user) ? "/admin/schools" : "/onboarding");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-brand-light/30 via-white to-white px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Logo size={40} tile />
          <span className="font-brand text-2xl font-semibold tracking-[0.12em] text-plum-800">ICAN</span>
        </div>
        <div className="card">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
            Set up your profile
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-plum-800">Before you start</h1>
          <p className="mt-2 text-sm text-slate-600">
            Please read and check each item. You only need to do this once.
          </p>
          <div className="mt-5">
            <AgreementForm />
          </div>
        </div>
        <p className="mt-4 text-center text-xs leading-5 text-slate-600">{EMPLOYEE_NOTICE}</p>
      </div>
    </main>
  );
}
