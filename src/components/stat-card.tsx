import Link from "next/link";

export type Tone = "navy" | "emerald" | "amber" | "gold" | "violet" | "rose" | "sky" | "slate";

// Every bg/label/hint pair below meets WCAG 2.1 AA (≥4.5:1) at the tiny
// 10–11px sizes these tiles use — checked with axe. Darker shades (e.g.
// amber-700 over amber-500) are deliberate; don't lighten without re-checking.
const TONES: Record<Tone, { bg: string; label: string; hint: string }> = {
  navy:    { bg: "bg-navy-700",     label: "text-navy-100",    hint: "text-navy-200" },
  emerald: { bg: "bg-emerald-700",  label: "text-emerald-100", hint: "text-emerald-100" },
  amber:   { bg: "bg-amber-700",    label: "text-amber-50",    hint: "text-amber-50" },
  gold:    { bg: "bg-gold-700",     label: "text-gold-50",     hint: "text-gold-100" },
  violet:  { bg: "bg-violet-600",   label: "text-violet-100",  hint: "text-violet-100" },
  rose:    { bg: "bg-rose-700",     label: "text-rose-100",    hint: "text-rose-100" },
  sky:     { bg: "bg-sky-700",      label: "text-sky-100",     hint: "text-sky-100" },
  slate:   { bg: "bg-slate-700",    label: "text-slate-200",   hint: "text-slate-300" },
};

// Filled colored stat tile — replaces the icon-on-pastel-circle pattern.
export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "navy",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: Tone;
}) {
  const t = TONES[tone];
  const inner = (
    <div className={`relative overflow-hidden rounded-2xl p-4 text-white ${t.bg} shadow-soft sm:p-5`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${t.label}`}>{label}</p>
      <p className="mt-1 font-display text-2xl font-black leading-none sm:text-3xl">{value}</p>
      {hint && <p className={`mt-1.5 text-[11px] font-medium ${t.hint}`}>{hint}</p>}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block transition hover:-translate-y-0.5 hover:shadow-lift cursor-pointer">
        {inner}
      </Link>
    );
  }
  return inner;
}

// Backwards-compat shim — older pages may still import StatCard / StatIcon.
export function StatCard(props: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tint?: Tone;
  icon?: React.ReactNode;
}) {
  return <StatTile label={props.label} value={props.value} hint={props.hint} href={props.href} tone={props.tint ?? "navy"} />;
}

export function StatIcon() {
  return null;
}
