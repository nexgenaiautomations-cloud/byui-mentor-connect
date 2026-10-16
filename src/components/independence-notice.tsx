import Link from "next/link";
import { THIRD_PARTY_NOTICE } from "@/lib/disclaimers";

// Third-party / non-affiliation notice. Rendered in every public footer, on
// the auth screens, and at the bottom of the signed-in shell.
export function IndependenceNotice({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const text = tone === "dark" ? "text-white/80" : "text-slate-600";
  const link =
    tone === "dark"
      ? "font-semibold text-white underline decoration-white/50 underline-offset-2 hover:decoration-white cursor-pointer"
      : "font-semibold text-brand underline decoration-brand-light underline-offset-2 hover:text-brand-dark cursor-pointer";
  return (
    <p role="note" className={`text-xs leading-5 ${text} ${className}`}>
      {THIRD_PARTY_NOTICE}{" "}
      <Link href="/terms" className={link}>
        Terms of Use
      </Link>
    </p>
  );
}
