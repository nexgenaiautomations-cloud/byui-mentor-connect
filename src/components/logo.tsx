// BYUI CAN crest. Two variants:
// - default: clean shield + handshake + wordmark (no 1-2-3 columns) for the
//   sidebar, topbar, login, etc.
// - "full": full crest with 1-2-3 columns (only used in the landing cadence
//   section where the numbered columns are meaningful).
export function Logo({
  size = 64,
  variant = "default",
  className = "",
  withText = false,
}: {
  size?: number;
  variant?: "default" | "full";
  className?: string;
  withText?: boolean;
}) {
  const aspect = variant === "full" ? 130 / 100 : 110 / 100;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox={variant === "full" ? "0 0 100 130" : "0 0 100 110"}
        width={size}
        height={size * aspect}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="BYUI CAN"
      >
        {variant === "full" ? <FullCrest /> : <SimpleCrest />}
      </svg>
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

function SimpleCrest() {
  return (
    <g>
      <defs>
        <linearGradient id="byuicanShield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#27497C" />
          <stop offset="100%" stopColor="#1B3A6B" />
        </linearGradient>
      </defs>
      {/* Outer shield */}
      <path
        d="M10 14 Q10 8 16 8 H84 Q90 8 90 14 V62 Q90 95 50 105 Q10 95 10 62 Z"
        fill="url(#byuicanShield)"
      />
      {/* Handshake on top */}
      <g fill="#FFFFFF">
        <path d="M30 14 q4 -6 12 -2 l4 3 q3 -2 7 0 l3 2 q3 2 1 5 l-4 5 q-2 2 -5 1 l-8 -3 -8 3 q-3 1 -5 -1 l-4 -5 q-2 -3 1 -5 z" />
      </g>
      {/* White banner with BYUI CAN */}
      <path d="M10 72 H90 V92 Q90 98 84 98 H16 Q10 98 10 92 Z" fill="#FFFFFF" />
      <text
        x="50"
        y="88"
        textAnchor="middle"
        fontFamily="Outfit, Inter, Arial, sans-serif"
        fontWeight="900"
        fontSize="13"
        fill="#1B3A6B"
        letterSpacing="0.6"
      >
        BYUI CAN
      </text>
    </g>
  );
}

function FullCrest() {
  return (
    <g>
      <defs>
        <linearGradient id="fc1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4870AE" />
          <stop offset="100%" stopColor="#3B5E97" />
        </linearGradient>
        <linearGradient id="fc2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#27497C" />
          <stop offset="100%" stopColor="#1F3D6B" />
        </linearGradient>
        <linearGradient id="fc3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#152C52" />
          <stop offset="100%" stopColor="#0E1F3A" />
        </linearGradient>
      </defs>
      <path
        d="M10 14 Q10 8 16 8 H84 Q90 8 90 14 V70 Q90 110 50 124 Q10 110 10 70 Z"
        fill="#1B3A6B"
      />
      <path
        d="M14 18 Q14 12 20 12 H80 Q86 12 86 18 V69 Q86 105 50 118 Q14 105 14 69 Z"
        fill="#FFFFFF"
      />
      <rect x="17" y="15" width="22" height="60" fill="url(#fc1)" />
      <rect x="39" y="15" width="22" height="60" fill="url(#fc2)" />
      <rect x="61" y="15" width="22" height="60" fill="url(#fc3)" />
      <path
        d="M38 17 q4 -6 12 -2 l4 3 q3 -2 7 0 l3 2 q3 2 1 5 l-4 5 q-2 2 -5 1 l-8 -3 -8 3 q-3 1 -5 -1 l-4 -5 q-2 -3 1 -5 z"
        fill="#1B3A6B"
      />
      <text x="28" y="48" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="20" fill="#FFFFFF">1</text>
      <text x="50" y="48" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="20" fill="#FFFFFF">2</text>
      <text x="72" y="48" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="20" fill="#FFFFFF">3</text>
      <path d="M10 78 H90 V95 Q90 100 84 100 H16 Q10 100 10 95 Z" fill="#FFFFFF" stroke="#1B3A6B" strokeWidth="1.5" />
      <text x="50" y="92" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="12" fill="#1B3A6B" letterSpacing="0.5">
        BYUI CAN
      </text>
    </g>
  );
}
