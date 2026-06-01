// BYUI CAN logo — plain shield + handshake + wordmark. Used everywhere; no
// numbered/edited variants.
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

// Full 1-2-3 crest with the BYUI CAN wordmark — used only as the centerpiece
// of the landing "rhythm" section so the program rhythm is visible at hero
// size. Logo (header/sidebar/login) stays the plain handshake.
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
