import Link from "next/link";

type Tint = "navy" | "emerald" | "amber" | "violet" | "rose";

const TINTS: Record<Tint, { bg: string; ring: string; text: string }> = {
  navy: { bg: "bg-navy-50", ring: "ring-navy-100", text: "text-navy-700" },
  emerald: { bg: "bg-emerald-50", ring: "ring-emerald-100", text: "text-emerald-700" },
  amber: { bg: "bg-amber-50", ring: "ring-amber-100", text: "text-amber-700" },
  violet: { bg: "bg-violet-50", ring: "ring-violet-100", text: "text-violet-700" },
  rose: { bg: "bg-rose-50", ring: "ring-rose-100", text: "text-rose-700" },
};

export function StatCard({
  label,
  value,
  hint,
  href,
  tint = "navy",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tint?: Tint;
  icon?: React.ReactNode;
}) {
  const t = TINTS[tint];
  const inner = (
    <div className="card flex items-start gap-4">
      {icon && (
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.bg} ${t.text} ring-1 ${t.ring}`}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 font-display text-3xl font-black text-navy-800">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
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

export function StatIcon({ kind }: { kind: "users" | "match" | "inbox" | "spark" | "calendar" | "chart" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      {kind === "users" && <><circle cx={9} cy={8} r={3.5} /><path d="M3 21c0-3.5 3-6 6-6s6 2.5 6 6" /><circle cx={17} cy={9} r={2.5} /><path d="M14 21c0-2.7 2-5 4-5" /></>}
      {kind === "match" && <><path d="M9 12a5 5 0 0 1 0-7L11 3a5 5 0 0 1 7 7l-1 1" /><path d="M15 12a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1" /></>}
      {kind === "inbox" && <><path d="M3 7h18" /><rect x={3} y={7} width={18} height={13} rx={2} /><path d="M3 13h5l2 3h4l2-3h5" /></>}
      {kind === "spark" && <><path d="m12 3 2.5 5 5.5.8-4 4 1 5.7-5-3-5 3 1-5.7-4-4 5.5-.8z" /></>}
      {kind === "calendar" && <><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M3 9h18M8 3v4M16 3v4" /></>}
      {kind === "chart" && <><path d="M4 20V4" /><path d="M20 20H4" /><path d="m7 16 4-5 3 3 6-7" /></>}
    </svg>
  );
}
