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
  color = "#4A2585",
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
  color = "#4A2585",
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
  color = "#4A2585",
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

// ---------------------------------------------------------------------------
// Program Effectiveness additions (docs/specs/accountability-upgrade.md §6).
// Same no-dependency approach as above: plain markup, server-renderable.
// ---------------------------------------------------------------------------

// Rate bars where a value can be suppressed (null) for small groups. Each
// row shows the numerator/denominator so a "100%" of 1 reads honestly.
export function RateBars({
  rows,
  color = "#4A2585",
  emptyText = "No data yet",
}: {
  rows: { label: string; pct: number | null; num: number; den: number; note?: string }[];
  color?: string;
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="text-xs text-slate-500">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-start justify-between gap-3 text-xs">
            <span className="min-w-0 break-words font-medium text-slate-700">{r.label}</span>
            <span className="shrink-0 font-semibold text-slate-900">
              {r.pct === null ? (
                <span className="text-slate-500" title="Not enough data to show a reliable rate">—</span>
              ) : (
                `${r.pct}%`
              )}
              <span className="ml-1 font-normal text-slate-500">
                ({r.num}/{r.den})
              </span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden>
            {r.pct !== null && (
              <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, r.pct)}%`, background: color }} />
            )}
          </div>
          {r.note && <p className="mt-0.5 text-[10px] text-slate-500">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

// Group x month heatmap. Cells carry the value AND n as text (not color
// alone), and the table is a real <table> so screen readers can navigate it.
export function Heatmap({
  rows,
  columns,
  caption,
}: {
  rows: { group: string; cells: { month: string; active: number; engaged: number; pct: number | null }[] }[];
  columns: { key: string; label: string }[];
  caption: string;
}) {
  if (rows.length === 0) return <p className="text-xs text-slate-500">No mentorship pairs in this view yet.</p>;
  const tone = (pct: number | null) =>
    pct === null
      ? "bg-slate-50 text-slate-500"
      : pct >= 75
        ? "bg-emerald-600 text-white"
        : pct >= 50
          ? "bg-emerald-200 text-emerald-950"
          : pct >= 25
            ? "bg-amber-200 text-amber-950"
            : "bg-rose-200 text-rose-950";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left font-semibold text-slate-600">Group</th>
            {columns.map((c) => (
              <th key={c.key} scope="col" className="min-w-[52px] text-center font-semibold text-slate-600">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.group}>
              <th scope="row" className="whitespace-nowrap pr-2 text-left font-medium text-slate-800">{r.group}</th>
              {r.cells.map((c) => (
                <td
                  key={c.month}
                  className={`rounded-md px-1 py-1.5 text-center ${tone(c.active ? c.pct : null)}`}
                  title={c.active ? `${c.engaged} of ${c.active} pairs interacted` : "No active pairs"}
                >
                  {c.active ? (
                    <>
                      <span className="block font-bold">{c.pct}%</span>
                      <span className="block text-[10px] opacity-80">n={c.active}</span>
                    </>
                  ) : (
                    "·"
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-600">
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-emerald-600 align-middle" />75%+ of pairs interacted</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-emerald-200 align-middle" />50–74%</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-amber-200 align-middle" />25–49%</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-rose-200 align-middle" />under 25%</span>
      </p>
    </div>
  );
}

// Stage funnel: each bar is unique students, width relative to the first
// stage, with step conversion shown alongside.
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  if (steps.every((s) => s.value === 0)) return <p className="text-xs text-slate-500">No career updates in this view yet.</p>;
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs">
            <span className="font-medium text-slate-700">{s.label}</span>
            <span className="h-5 rounded bg-slate-100" aria-hidden>
              <span
                className="block h-5 rounded bg-plum-600"
                style={{ width: `${Math.max(s.value ? 3 : 0, Math.round((s.value / max) * 100))}%` }}
              />
            </span>
            <span className="w-20 text-right font-semibold text-slate-900">
              {s.value}
              {conv !== null && <span className="ml-1 font-normal text-slate-500">({conv}%)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
