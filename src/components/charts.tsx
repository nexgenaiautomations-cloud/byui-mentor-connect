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

export function MonthlyLine({
  points,
  height = 90,
  color = "#1B3A6B",
  unit = "",
  format = (n: number) => `${n}`,
}: {
  points: Pt[];
  height?: number;
  color?: string;
  unit?: string;
  format?: (n: number) => string;
}) {
  if (points.length === 0) {
    return <div className="text-xs text-slate-400">No data</div>;
  }
  const w = 100; // viewBox is normalized to width=100; SVG scales to container
  const top = niceTop(Math.max(...points.map((p) => p.value)));
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const toY = (v: number) => height - (v / top) * (height - 12) - 6;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(2)} ${toY(p.value).toFixed(2)}`)
    .join(" ");
  const area = `${path} L ${(stepX * (points.length - 1)).toFixed(2)} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block h-20 w-full">
        <defs>
          <linearGradient id="mline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#mline-grad)" />
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={i * stepX} cy={toY(p.value)} r={1.2} fill={color} />
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-slate-400">
        <span>{points[0]?.label}</span>
        <span className="text-slate-600">{format(last.value)}{unit}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}

export function MonthlyBars({
  points,
  height = 90,
  color = "#0F766E",
  format = (n: number) => `${n}`,
}: {
  points: Pt[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  if (points.length === 0) {
    return <div className="text-xs text-slate-400">No data</div>;
  }
  const w = 100;
  const top = niceTop(Math.max(...points.map((p) => p.value), 1));
  const barW = (w / points.length) * 0.72;
  const gap = (w / points.length) * 0.28;
  const toH = (v: number) => (v / top) * (height - 14);

  const last = points[points.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block h-20 w-full">
        {points.map((p, i) => {
          const h = toH(p.value);
          const x = i * (barW + gap) + gap / 2;
          const y = height - h - 4;
          return <rect key={i} x={x} y={y} width={barW} height={h} fill={color} rx={0.6} />;
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-slate-400">
        <span>{points[0]?.label}</span>
        <span className="text-slate-600">{format(last.value)}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}

// Horizontal bar list for distributions (top N).
export function HBarList({
  rows,
  format = (n: number) => `${n}`,
  color = "#1B3A6B",
}: {
  rows: { label: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
}) {
  if (rows.length === 0) return <p className="text-xs text-slate-400">No data</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = Math.max(2, Math.round((r.value / max) * 100));
        return (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-700">{r.label}</span>
              <span className="font-semibold text-slate-900">{format(r.value)}</span>
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
          fontFamily="ui-sans-serif"
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
