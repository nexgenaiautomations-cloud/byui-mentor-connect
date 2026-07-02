// Tiny inline SVG charts so the analytics page doesn't pull a chart lib.
// Server-renderable; no client-side state.

type Pt = { label: string; value: number };

function niceTop(max: number) {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const rounded = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return rounded * pow;
}

function formatY(n: number, custom?: (n: number) => string) {
  if (custom) return custom(n);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

// Full-axis charts use a 100x100 viewBox with explicit margins so the axis
// text never gets squished. Sparklines drop all chrome.
const FULL = {
  left: 14,
  right: 100,
  top: 4,
  bottom: 78,
  height: 100,
};
const FULL_PLOT_W = FULL.right - FULL.left;

// Pick which x-axis labels to keep so 12 months don't collide. Every other
// month plus the last one gives 6-7 ticks, which fits cleanly.
function pickLabelIndices(n: number): Set<number> {
  if (n <= 1) return new Set([0]);
  const step = n <= 6 ? 1 : 2;
  const ids = new Set<number>();
  for (let i = 0; i < n; i += step) ids.add(i);
  ids.add(n - 1);
  return ids;
}

export function MonthlyLine({
  points,
  color = "#1B3A6B",
  unit = "",
  format,
  compact = false,
}: {
  points: Pt[];
  color?: string;
  unit?: string;
  format?: (n: number) => string;
  compact?: boolean;
}) {
  if (points.length === 0) {
    return <div className="text-xs text-slate-500">No data</div>;
  }

  if (compact) return <Sparkline points={points} color={color} kind="line" />;

  const top = niceTop(Math.max(...points.map((p) => p.value), 1));
  const plotH = FULL.bottom - FULL.top;
  const stepX = points.length > 1 ? FULL_PLOT_W / (points.length - 1) : 0;
  const xAt = (i: number) => FULL.left + i * stepX;
  const yAt = (v: number) => FULL.top + (1 - v / top) * plotH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.value).toFixed(2)}`)
    .join(" ");
  const area = `${path} L ${xAt(points.length - 1).toFixed(2)} ${FULL.bottom} L ${FULL.left} ${FULL.bottom} Z`;
  const last = points[points.length - 1];
  const labelIdx = pickLabelIndices(points.length);
  const gridYs = [0, top / 2, top];
  const gradId = `mline-grad-${color.replace("#", "")}`;

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${FULL.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-36 w-full"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridYs.map((v, i) => {
          const y = yAt(v);
          return (
            <g key={i}>
              <line
                x1={FULL.left}
                x2={FULL.right}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="0.3"
              />
              <text
                x={FULL.left - 1.5}
                y={y + 1}
                textAnchor="end"
                fontSize="3"
                fill="#94A3B8"
                fontFamily="Inter, ui-sans-serif, system-ui"
              >
                {formatY(v, format)}
              </text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={xAt(i)} cy={yAt(p.value)} r={0.7} fill={color} />
        ))}
        {points.map((p, i) =>
          labelIdx.has(i) ? (
            <text
              key={i}
              x={xAt(i)}
              y={FULL.bottom + 5}
              textAnchor="middle"
              fontSize="3.2"
              fill="#64748B"
              fontFamily="Inter, ui-sans-serif, system-ui"
            >
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      <p className="mt-1 text-right text-[11px] font-semibold text-slate-600">
        {(format ?? ((n: number) => String(n)))(last.value)}
        {unit} this month
      </p>
    </div>
  );
}

export function MonthlyBars({
  points,
  color = "#0F766E",
  format,
  compact = false,
}: {
  points: Pt[];
  color?: string;
  format?: (n: number) => string;
  compact?: boolean;
}) {
  if (points.length === 0) {
    return <div className="text-xs text-slate-500">No data</div>;
  }

  if (compact) return <Sparkline points={points} color={color} kind="bar" />;

  const top = niceTop(Math.max(...points.map((p) => p.value), 1));
  const plotH = FULL.bottom - FULL.top;
  const colW = FULL_PLOT_W / points.length;
  const barW = colW * 0.7;
  const padX = (colW - barW) / 2;
  const last = points[points.length - 1];
  const labelIdx = pickLabelIndices(points.length);
  const gridYs = [0, top / 2, top];

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${FULL.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-36 w-full"
      >
        {gridYs.map((v, i) => {
          const y = FULL.top + (1 - v / top) * plotH;
          return (
            <g key={i}>
              <line
                x1={FULL.left}
                x2={FULL.right}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="0.3"
              />
              <text
                x={FULL.left - 1.5}
                y={y + 1}
                textAnchor="end"
                fontSize="3"
                fill="#94A3B8"
                fontFamily="Inter, ui-sans-serif, system-ui"
              >
                {formatY(v, format)}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const h = (p.value / top) * plotH;
          const x = FULL.left + i * colW + padX;
          const y = FULL.bottom - h;
          return <rect key={i} x={x} y={y} width={barW} height={h} fill={color} rx={0.4} />;
        })}
        {points.map((p, i) =>
          labelIdx.has(i) ? (
            <text
              key={i}
              x={FULL.left + i * colW + colW / 2}
              y={FULL.bottom + 5}
              textAnchor="middle"
              fontSize="3.2"
              fill="#64748B"
              fontFamily="Inter, ui-sans-serif, system-ui"
            >
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      <p className="mt-1 text-right text-[11px] font-semibold text-slate-600">
        {(format ?? ((n: number) => String(n)))(last.value)} this month
      </p>
    </div>
  );
}

// Minimal sparkline — no axes, no labels — for use inside MoMTile etc. We
// fill the whole viewBox so the chart shape is the only signal.
function Sparkline({
  points,
  color,
  kind,
}: {
  points: Pt[];
  color: string;
  kind: "line" | "bar";
}) {
  const w = 100;
  const h = 32;
  const top = Math.max(...points.map((p) => p.value), 1);

  if (kind === "bar") {
    const colW = w / points.length;
    const barW = colW * 0.7;
    const padX = (colW - barW) / 2;
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="block h-12 w-full"
      >
        {points.map((p, i) => {
          const bh = (p.value / top) * h;
          return (
            <rect
              key={i}
              x={i * colW + padX}
              y={h - bh}
              width={barW}
              height={bh}
              fill={color}
              rx={0.4}
            />
          );
        })}
      </svg>
    );
  }

  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const xAt = (i: number) => i * stepX;
  const yAt = (v: number) => h - (v / top) * (h - 2) - 1;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.value).toFixed(2)}`)
    .join(" ");
  const area = `${path} L ${xAt(points.length - 1).toFixed(2)} ${h} L 0 ${h} Z`;
  const gradId = `spark-${color.replace("#", "")}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="block h-12 w-full"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Horizontal bar list for distributions (top N). Labels wrap rather than
// truncating so narrow cards (xl:grid-cols-4) stay readable.
export function HBarList({
  rows,
  format = (n: number) => `${n}`,
  color = "#1B3A6B",
}: {
  rows: { label: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
}) {
  if (rows.length === 0) return <p className="text-xs text-slate-500">No data</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = Math.max(2, Math.round((r.value / max) * 100));
        return (
          <li key={r.label}>
            <div className="flex items-start justify-between gap-3 text-xs">
              <span className="min-w-0 break-words font-medium text-slate-700">
                {r.label}
              </span>
              <span className="shrink-0 font-semibold text-slate-900">
                {format(r.value)}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Compact donut showing one part vs. whole.
export function Donut({
  value,
  total,
  size = 96,
  color = "#1B3A6B",
  trackColor = "#E2E8F0",
  label,
}: {
  value: number;
  total: number;
  size?: number;
  color?: string;
  trackColor?: string;
  label?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 40 40" className="block">
        <circle cx="20" cy="20" r={r} fill="none" stroke={trackColor} strokeWidth={5} />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
        <text
          x="20"
          y="22"
          textAnchor="middle"
          fontSize="9"
          fontWeight="800"
          fill="#0f172a"
          fontFamily="Inter, ui-sans-serif, system-ui"
        >
          {pct}%
        </text>
      </svg>
      {label && <span className="text-xs font-medium text-slate-600">{label}</span>}
    </div>
  );
}

// "+12% MoM" pill with arrow direction.
export function DeltaPill({
  current,
  previous,
  asPercentPoints = false,
  goodWhen = "up",
}: {
  current: number;
  previous: number;
  asPercentPoints?: boolean;
  goodWhen?: "up" | "down";
}) {
  if (previous === 0 && current === 0) {
    return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">—</span>;
  }
  let delta: number;
  let suffix: string;
  if (asPercentPoints) {
    delta = current - previous;
    suffix = "pp";
  } else if (previous === 0) {
    delta = 100;
    suffix = "%";
  } else {
    delta = ((current - previous) / previous) * 100;
    suffix = "%";
  }
  const up = delta >= 0;
  const good = (up && goodWhen === "up") || (!up && goodWhen === "down");
  const cls = good
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-rose-50 text-rose-700 ring-rose-200";
  const sign = up ? "▲" : "▼";
  const shown = Math.abs(delta).toFixed(asPercentPoints ? 1 : 0);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cls}`}>
      {sign} {shown}{suffix}
    </span>
  );
}
