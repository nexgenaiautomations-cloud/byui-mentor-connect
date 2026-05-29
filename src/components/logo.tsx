// BYUI CAN logo — the simpler shield + handshake + wordmark (no 1-2-3 columns).
// For the full 1-2-3 crest (used only in the landing "rhythm" section), see
// /public/byuican-crest.png.
export function Logo({
  size = 56,
  className = "",
  withText = false,
}: {
  size?: number;
  className?: string;
  withText?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/byuican-icon.png"
        alt="BYUI CAN — Career Advancement Network"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="select-none"
      />
      {withText && (
        <span className="leading-tight">
          <span className="block font-display text-sm font-black tracking-tight text-white">BYUI CAN</span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Mentor Connect
          </span>
        </span>
      )}
    </span>
  );
}

// Full 1-2-3 crest — used only for the landing's BYUI CAN rhythm section.
export function FullCrest({ size = 380 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/byuican-crest.png"
      alt="BYUI CAN — 1 Career Task weekly, 2 Internships before senior year, 3 Career Chats monthly"
      width={size}
      height={(size * 1536) / 1024}
      style={{ width: size, height: (size * 1536) / 1024 }}
      className="select-none"
    />
  );
}
