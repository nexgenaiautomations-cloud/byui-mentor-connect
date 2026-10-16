import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { IndependenceNotice } from "@/components/independence-notice";
import { SchoolInquiryForm } from "./inquiry-form";

export const metadata: Metadata = {
  title: "For schools — ICAN Mentor Connect",
  description:
    "Bring ICAN peer mentorship to your school. Tell us about your school and we'll add your student email domain.",
};

const STEPS = [
  { title: "Tell us about your school", body: "Send the form below. It goes straight to the ICAN team." },
  { title: "We talk it through", body: "We'll confirm how your students and mentors would use ICAN." },
  { title: "We add your email domain", body: "Once you sign on, students with your school email can register." },
];

export default function SchoolsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-light/30 via-white to-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
        <Link href="/" className="flex items-center gap-3 cursor-pointer">
          <Logo size={40} tile />
          <span className="font-brand text-2xl font-semibold tracking-[0.12em] text-plum-800">ICAN</span>
        </Link>

        <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.18em] text-brand">For schools</p>
        <h1 className="mt-1 font-display text-3xl font-black text-brand-dark md:text-4xl">
          Bring ICAN to your school
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          ICAN is open to students whose school has signed on. If you work at a school and
          want your students to have structured peer career mentoring, tell us a little about
          your school and we&apos;ll be in touch.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-brand-light/40">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              <p className="mt-3 font-display text-base font-bold text-brand-dark">{s.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{s.body}</p>
            </li>
          ))}
        </ol>

        <section className="card mt-8">
          <h2 className="font-display text-xl font-bold text-brand-dark">Contact the ICAN team</h2>
          <div className="mt-5">
            <SchoolInquiryForm />
          </div>
        </section>

        <IndependenceNotice className="mt-8" />
      </div>
    </main>
  );
}
