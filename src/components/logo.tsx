// BYUI CAN crest. Uses the official crest PNG. Two sizes:
// - default (small): 256px source, used in sidebar/topbar/login
// - large: 800px source, used hero-sized on the landing page
export function Logo({
  size = 64,
  variant = "default",
  className = "",
  withText = false,
}: {
  size?: number;
  variant?: "default" | "large";
  className?: string;
  withText?: boolean;
}) {
  const src = variant === "large" ? "/byuican-crest.png" : "/byuican-crest-sm.png";
  // The official crest is ~2:3 aspect (1024x1536) — keep that.
  const aspectH = (size * 1536) / 1024;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="BYUI CAN — Career Advancement Network"
        width={size}
        height={aspectH}
        style={{ width: size, height: aspectH }}
        className="select-none"
      />
      {withText && (
        <span className="leading-tight">
          <span className="block font-display text-sm font-black tracking-tight text-navy-800">BYUI CAN</span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-navy-700/70">
            Mentor Connect
          </span>
        </span>
      )}
    </span>
  );
}
