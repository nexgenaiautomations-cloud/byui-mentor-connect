// BYUI CAN crest. Inline SVG so it scales crisply and inherits text color.
export function Logo({
  size = 64,
  showWordmark = false,
  className = "",
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 100 130"
        width={size}
        height={(size * 130) / 100}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="BYUI CAN"
      >
        <defs>
          <linearGradient id="byuicanCol1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4870AE" />
            <stop offset="100%" stopColor="#3B5E97" />
          </linearGradient>
          <linearGradient id="byuicanCol2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#27497C" />
            <stop offset="100%" stopColor="#1F3D6B" />
          </linearGradient>
          <linearGradient id="byuicanCol3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#152C52" />
            <stop offset="100%" stopColor="#0E1F3A" />
          </linearGradient>
        </defs>

        {/* Shield outline */}
        <path
          d="M10 14 Q10 8 16 8 H84 Q90 8 90 14 V70 Q90 110 50 124 Q10 110 10 70 Z"
          fill="#1B3A6B"
        />
        <path
          d="M14 18 Q14 12 20 12 H80 Q86 12 86 18 V69 Q86 105 50 118 Q14 105 14 69 Z"
          fill="#FFFFFF"
        />

        {/* Three columns */}
        <rect x="17" y="15" width="22" height="60" fill="url(#byuicanCol1)" />
        <rect x="39" y="15" width="22" height="60" fill="url(#byuicanCol2)" />
        <rect x="61" y="15" width="22" height="60" fill="url(#byuicanCol3)" />

        {/* Handshake (simplified) */}
        <g fill="#1B3A6B">
          <path d="M38 17 q4 -6 12 -2 l4 3 q3 -2 7 0 l3 2 q3 2 1 5 l-4 5 q-2 2 -5 1 l-8 -3 -8 3 q-3 1 -5 -1 l-4 -5 q-2 -3 1 -5 z" />
        </g>

        {/* Column numbers */}
        <text x="28" y="48" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="20" fill="#FFFFFF">1</text>
        <text x="50" y="48" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="20" fill="#FFFFFF">2</text>
        <text x="72" y="48" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="20" fill="#FFFFFF">3</text>

        {/* Bottom banner with BYUI CAN */}
        <path d="M10 78 H90 V95 Q90 100 84 100 H16 Q10 100 10 95 Z" fill="#FFFFFF" stroke="#1B3A6B" strokeWidth="1.5" />
        <text x="50" y="92" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="12" fill="#1B3A6B" letterSpacing="0.5">
          BYUI CAN
        </text>

        {/* BYU IDAHO chip */}
        <rect x="38" y="103" width="24" height="14" fill="#1B3A6B" />
        <text x="50" y="110" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="4.5" fill="#FFFFFF">BYU</text>
        <text x="50" y="115" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="700" fontSize="3.5" fill="#FFFFFF">IDAHO</text>
      </svg>
      {showWordmark && (
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
