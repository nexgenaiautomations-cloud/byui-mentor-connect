import Link from "next/link";

type Kind = "mentor" | "request" | "match" | "meeting" | "application";

const ART: Record<Kind, React.ReactNode> = {
  mentor: (
    <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none">
      <circle cx="60" cy="60" r="56" fill="#F1F5FB" />
      <circle cx="60" cy="48" r="14" stroke="#1B3A6B" strokeWidth="3" />
      <path d="M30 92c4-14 16-22 30-22s26 8 30 22" stroke="#1B3A6B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="86" cy="36" r="8" fill="#C9A227" />
      <path d="M86 32v8M82 36h8" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  request: (
    <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none">
      <circle cx="60" cy="60" r="56" fill="#F1F5FB" />
      <rect x="28" y="40" width="64" height="44" rx="6" stroke="#1B3A6B" strokeWidth="3" />
      <path d="M28 46l32 22 32-22" stroke="#1B3A6B" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="92" cy="40" r="9" fill="#C9A227" />
    </svg>
  ),
  match: (
    <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none">
      <circle cx="60" cy="60" r="56" fill="#F1F5FB" />
      <path d="M44 60a14 14 0 1 1 28 0M48 60a10 10 0 1 0 24 0" stroke="#1B3A6B" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 60h12M78 60h12" stroke="#1B3A6B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="44" r="6" fill="#C9A227" />
    </svg>
  ),
  meeting: (
    <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none">
      <circle cx="60" cy="60" r="56" fill="#F1F5FB" />
      <rect x="34" y="38" width="52" height="48" rx="6" stroke="#1B3A6B" strokeWidth="3" />
      <path d="M34 50h52M48 34v8M72 34v8" stroke="#1B3A6B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="64" r="3" fill="#C9A227" />
      <circle cx="60" cy="64" r="3" fill="#1B3A6B" />
      <circle cx="72" cy="64" r="3" fill="#1B3A6B" />
    </svg>
  ),
  application: (
    <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none">
      <circle cx="60" cy="60" r="56" fill="#F1F5FB" />
      <rect x="36" y="32" width="48" height="60" rx="4" stroke="#1B3A6B" strokeWidth="3" />
      <path d="M44 48h32M44 60h32M44 72h22" stroke="#1B3A6B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="86" cy="84" r="9" fill="#C9A227" />
      <path d="M82 84l3 3 5-5" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function EmptyState({
  kind,
  title,
  message,
  cta,
}: {
  kind: Kind;
  title: string;
  message: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="card flex flex-col items-center text-center py-12">
      <div className="mb-4">{ART[kind]}</div>
      <p className="font-display text-lg font-bold text-navy-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{message}</p>
      {cta && (
        <Link href={cta.href} className="btn-primary mt-5">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
