// ICAN logo — handshake mark + optional wordmark. The plain mark is white
// (for the purple sidebar / hero); `tile` puts the purple mark on a white
// rounded tile so it reads on light pages.
export function Logo({
  size = 56,
  className = "",
  withText = false,
  tile = false,
}: {
  size?: number;
  className?: string;
  withText?: boolean;
  tile?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile ? "/ican-icon.png" : "/ican-handshake-white.png"}
        alt="ICAN — Career Advancement Network"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={tile ? "select-none rounded-lg shadow-soft ring-1 ring-brand-light/50" : "select-none"}
      />
      {withText && (
        <span className="leading-tight">
          <span className="block font-brand text-base font-semibold tracking-[0.14em] text-white">ICAN</span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Career Advancement Network
          </span>
        </span>
      )}
    </span>
  );
}

// ICAN shield — "ICAN" with "Career Advancement Network" underneath. Hero
// centerpiece on the landing page.
export function Shield({ size = 260, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ican-shield.png"
      alt="ICAN — Career Advancement Network shield"
      width={size}
      height={(size * 1100) / 1000}
      className={`select-none ${className}`}
    />
  );
}

// Full 1-2-3 crest with the ICAN wordmark — used only as the centerpiece
// of the landing "rhythm" section so the program rhythm is visible at hero
// size. Logo (header/sidebar/login) stays the plain handshake.
export function FullCrest({ size = 380 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ican-crest.png"
      alt="ICAN — 1 Career Task weekly, 2 Internships before senior year, 3 Career Chats monthly"
      width={size}
      height={(size * 1500) / 1000}
      style={{ width: size, height: (size * 1500) / 1000 }}
      className="select-none"
    />
  );
}
