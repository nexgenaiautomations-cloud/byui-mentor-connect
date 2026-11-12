"use client";

// Interactive analytics charts built on the shadcn/ui chart primitives
// (src/components/ui/chart.tsx, Recharts). Server pages aggregate the data
// and pass small arrays here — no raw student rows reach the browser.
//
// Rules every chart follows:
//   * null means "not enough data / not applicable": drawn as a gap and shown
//     as "—", never as 0
//   * rates use a fixed 0–100% axis; counts start at 0 (no misleading zoom)
//   * a visually hidden table carries the exact numbers for screen readers
//   * animation is off for prefers-reduced-motion (and during SSR)
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useClientValue } from "@/lib/use-client-value";
import { cn } from "@/lib/cn";

export { CHART_COLORS } from "@/lib/chart-colors";

export type Series = { key: string; label: string; color: string };
export type Datum = { label: string } & Record<string, number | string | null>;
type Format = "count" | "percent" | "hours" | "decimal";

function fmt(v: number | null | undefined, f: Format): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (f === "percent") return `${Math.round(v * 10) / 10}%`;
  if (f === "hours") return `${Math.round(v * 10) / 10} h`;
  if (f === "decimal") return `${Math.round(v * 10) / 10}`;
  return v.toLocaleString();
}

function useReducedMotion(): boolean {
  return useClientValue(
    () => (typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false),
    true
  );
}

function config(series: Series[]): ChartConfig {
  return Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
}

function hasData(data: Datum[], series: Series[]): boolean {
  return data.some((d) => series.some((s) => typeof d[s.key] === "number" && (d[s.key] as number) !== 0));
}

function Empty({ text, height }: { text: string; height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center text-sm text-slate-600"
      style={{ height }}
    >
      {text}
    </div>
  );
}

// Exact values for assistive tech (charts are role="img" with a summary).
function DataTable({ caption, data, series, format }: { caption: string; data: Datum[]; series: Series[]; format: Format }) {
  return (
    // Wrapped in a div: a <table> ignores the 1px width of .sr-only and
    // would widen the page on phones.
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.label}>
            <th scope="row">{d.label}</th>
            {series.map((s) => (
              <td key={s.key}>{fmt(d[s.key] as number | null, format)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

type CommonProps = {
  title: string; // used for the accessible name and hidden table caption
  data: Datum[];
  series: Series[];
  format?: Format;
  height?: number;
  emptyText?: string;
  className?: string;
};

function yAxisFor(format: Format) {
  return format === "percent" ? (
    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} width={40} tickLine={false} axisLine={false} />
  ) : (
    <YAxis allowDecimals={format !== "count"} width={format === "count" ? 36 : 48} tickLine={false} axisLine={false} domain={[0, "auto"]} tickFormatter={(v: number) => (format === "count" ? `${v}` : `${Math.round(v * 100) / 100}`)} />
  );
}

const tooltip = (format: Format) => (
  <ChartTooltip
    cursor
    content={
      <ChartTooltipContent
        formatter={(value, name, item) => (
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: item.color }} />
              {item.name ?? name}
            </span>
            <span className="font-mono font-semibold tabular-nums text-slate-900">{fmt(value as number | null, format)}</span>
          </div>
        )}
      />
    }
  />
);

// Smooth area chart for trends (optionally stacked).
export function AreaTrend({ title, data, series, format = "count", height = 240, emptyText = "No data for this period yet.", stacked = false, className }: CommonProps & { stacked?: boolean }) {
  const reduced = useReducedMotion();
  if (!hasData(data, series)) return <Empty text={emptyText} height={height} />;
  return (
    <figure className={cn("w-full", className)}>
      <ChartContainer config={config(series)} className="aspect-auto w-full" style={{ height }} role="img" aria-label={title}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={0.35} />
                <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.03} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          {yAxisFor(format)}
          {tooltip(format)}
          {series.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              name={s.label}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              fill={`url(#fill-${s.key})`}
              stackId={stacked ? "a" : undefined}
              connectNulls={false}
              isAnimationActive={!reduced}
              animationDuration={600}
            />
          ))}
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        </AreaChart>
      </ChartContainer>
      <DataTable caption={title} data={data} series={series} format={format} />
    </figure>
  );
}

// Line chart for comparing rates over time.
export function LineTrend({ title, data, series, format = "count", height = 240, emptyText = "No data for this period yet.", className }: CommonProps) {
  const reduced = useReducedMotion();
  if (!hasData(data, series)) return <Empty text={emptyText} height={height} />;
  return (
    <figure className={cn("w-full", className)}>
      <ChartContainer config={config(series)} className="aspect-auto w-full" style={{ height }} role="img" aria-label={title}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          {yAxisFor(format)}
          {tooltip(format)}
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              strokeWidth={2.25}
              dot={{ r: 3, strokeWidth: 0, fill: `var(--color-${s.key})` }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={!reduced}
              animationDuration={600}
            />
          ))}
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        </LineChart>
      </ChartContainer>
      <DataTable caption={title} data={data} series={series} format={format} />
    </figure>
  );
}

// Vertical grouped or stacked bars, or horizontal bars (layout="horizontal").
// `rowColors` colors single-series horizontal bars per row (severity bars).
export function Bars({
  title,
  data,
  series,
  format = "count",
  height = 260,
  emptyText = "No data for this period yet.",
  stacked = false,
  horizontal = false,
  rowColors,
  showValues = false,
  className,
}: CommonProps & { stacked?: boolean; horizontal?: boolean; rowColors?: string[]; showValues?: boolean }) {
  const reduced = useReducedMotion();
  if (!hasData(data, series)) return <Empty text={emptyText} height={height} />;
  const h = horizontal ? Math.max(height, data.length * 44 + 32) : height;
  return (
    <figure className={cn("w-full", className)}>
      <ChartContainer config={config(series)} className="aspect-auto w-full" style={{ height: h }} role="img" aria-label={title}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: showValues ? 40 : 12, left: 0, bottom: 0 }}
          barCategoryGap={horizontal ? 10 : "20%"}
          accessibilityLayer
        >
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} strokeDasharray="3 3" />
          {horizontal ? (
            <>
              <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={190} tick={{ fontSize: 12 }} interval={0} />
              <XAxis
                type="number"
                domain={format === "percent" ? [0, 100] : [0, "auto"]}
                allowDecimals={format !== "count"}
                tickFormatter={(v: number) => (format === "percent" ? `${v}%` : `${v}`)}
                tickLine={false}
                axisLine={false}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
              {yAxisFor(format)}
            </>
          )}
          {tooltip(format)}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={`var(--color-${s.key})`}
              stackId={stacked ? "a" : undefined}
              radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              isAnimationActive={!reduced}
              animationDuration={500}
              maxBarSize={horizontal ? 28 : 40}
            >
              {rowColors && data.map((d, j) => <Cell key={d.label} fill={rowColors[j % rowColors.length]} />)}
              {showValues && (
                <LabelList
                  dataKey={s.key}
                  position={horizontal ? "right" : "top"}
                  className="fill-slate-700"
                  fontSize={12}
                  formatter={(v: unknown) => fmt(v as number | null, format)}
                />
              )}
            </Bar>
          ))}
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        </BarChart>
      </ChartContainer>
      <DataTable caption={title} data={data} series={series} format={format} />
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Interactive heatmap — the primary view for anything "group × time".
// A real grid: every cell is focusable and announces its value, hover/focus
// shows a tooltip, and null cells (suppressed or no data) are visibly
// different from low values.
// ---------------------------------------------------------------------------

export type HeatCell = { value: number | null; n?: number | null; note?: string };
export type HeatRow = { label: string; cells: HeatCell[] };
type Scale = "purple" | "health";

// Five discrete steps per scale. Stepped (not continuous) so every step can
// carry text at WCAG AA: a smooth gradient passes through mid-tones where
// neither dark nor white text reaches 4.5:1. Verified in
// tests/unit/heatmap-contrast.test.ts.
const SCALES: Record<Scale, string[]> = {
  // Single-hue sequential for volumes and neutral rates.
  purple: ["#F5F3FF", "#DDD6FE", "#C4B5FD", "#7C3AED", "#4C1D95"],
  // Higher is better (engagement, completion): risk → attention → healthy.
  health: ["#FECDD3", "#FED7AA", "#FEF08A", "#BBF7D0", "#15803D"],
};

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function heatColor(t: number, scale: Scale): string {
  const steps = SCALES[scale];
  const i = Math.min(steps.length - 1, Math.max(0, Math.floor(Math.min(1, Math.max(0, t)) * steps.length)));
  return steps[i];
}

// Pick whichever of dark or white text has the higher WCAG contrast ratio
// against the cell (relative luminance with sRGB gamma).
function luminance([r, g, b]: [number, number, number]): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
export function textOn(bg: string): string {
  const rgb = bg.startsWith("rgb") ? (bg.match(/\d+/g)!.map(Number) as [number, number, number]) : hexToRgb(bg);
  const L = luminance(rgb);
  const vsDark = (L + 0.05) / (luminance([15, 23, 42]) + 0.05);
  const vsWhite = 1.05 / (L + 0.05);
  return vsDark >= vsWhite ? "#0F172A" : "#FFFFFF";
}

export function HeatmapChart({
  title,
  rows,
  columns,
  format = "percent",
  scale = "purple",
  max,
  rowHeader = "Group",
  emptyText = "No data for this view yet.",
  legendLow,
  legendHigh,
  cellUnit,
}: {
  title: string;
  rows: HeatRow[];
  columns: string[];
  format?: Format;
  scale?: Scale;
  max?: number; // defaults to 100 for percent, else the largest value
  rowHeader?: string;
  emptyText?: string;
  legendLow?: string;
  legendHigh?: string;
  cellUnit?: string; // e.g. "pairs" for the n line in tooltips
}) {
  const [hover, setHover] = React.useState<{ r: number; c: number } | null>(null);
  const values = rows.flatMap((r) => r.cells.map((c) => c.value)).filter((v): v is number => v !== null);
  // All-zero counts (e.g. no cases at all) read better as an explained empty state.
  if (rows.length === 0 || values.length === 0 || (format === "count" && values.every((v) => v === 0))) {
    return <Empty text={emptyText} height={140} />;
  }
  const top = max ?? (format === "percent" ? 100 : Math.max(1, ...values));
  const active = hover ? { row: rows[hover.r], col: columns[hover.c], cell: rows[hover.r].cells[hover.c] } : null;

  return (
    <figure className="w-full">
      <div className="relative overflow-x-auto pb-1">
        <table className="w-full min-w-max border-separate border-spacing-[3px] text-xs" aria-label={title}>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-white pr-3 text-left font-semibold text-slate-600">
                {rowHeader}
              </th>
              {columns.map((c) => (
                <th key={c} scope="col" className="min-w-[46px] px-1 text-center font-semibold text-slate-600">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.label}>
                <th scope="row" className="sticky left-0 z-10 max-w-[180px] truncate bg-white pr-3 text-left font-medium text-slate-800" title={row.label}>
                  {row.label}
                </th>
                {row.cells.map((cell, c) => {
                  const isNull = cell.value === null;
                  const bg = isNull ? "#F8FAFC" : heatColor((cell.value as number) / top, scale);
                  const label = `${row.label}, ${columns[c]}: ${isNull ? (cell.note ?? "not enough data") : fmt(cell.value, format)}${cell.n != null ? `, n=${cell.n}` : ""}`;
                  return (
                    <td
                      key={c}
                      tabIndex={0}
                      aria-label={label}
                      onMouseEnter={() => setHover({ r, c })}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ r, c })}
                      onBlur={() => setHover(null)}
                      className={cn(
                        "h-10 rounded-md text-center font-semibold tabular-nums outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-plum-600 focus-visible:ring-offset-1",
                        hover?.r === r && hover?.c === c && "ring-2 ring-plum-700 ring-offset-1",
                        isNull && "bg-[repeating-linear-gradient(135deg,#F1F5F9_0,#F1F5F9_4px,#FFFFFF_4px,#FFFFFF_8px)] text-slate-500"
                      )}
                      style={isNull ? undefined : { background: bg, color: textOn(bg) }}
                    >
                      {isNull ? "—" : fmt(cell.value, format)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Tooltip line: always in the same place so it never clips on phones. */}
      <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs text-slate-700">
        {active ? (
          <>
            <strong>{active.row.label}</strong> · {active.col}:{" "}
            <strong className="tabular-nums">{active.cell.value === null ? "—" : fmt(active.cell.value, format)}</strong>
            {active.cell.n != null && (
              <span className="text-slate-500">
                {" "}
                (n={active.cell.n}
                {cellUnit ? ` ${cellUnit}` : ""})
              </span>
            )}
            {active.cell.value === null && <span className="text-slate-500"> — {active.cell.note ?? "not enough data"}</span>}
          </>
        ) : (
          <span className="text-slate-500">Hover or tab to a cell for details.</span>
        )}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span>{legendLow ?? (format === "percent" ? "0%" : "0")}</span>
        <span aria-hidden className="inline-flex overflow-hidden rounded-sm">
          {SCALES[scale].map((c) => (
            <span key={c} className="h-2.5 w-7" style={{ background: c }} />
          ))}
        </span>
        <span>{legendHigh ?? fmt(top, format)}</span>
        <span className="ml-2 inline-flex items-center gap-1">
          <span aria-hidden className="h-2.5 w-4 rounded-sm bg-[repeating-linear-gradient(135deg,#E2E8F0_0,#E2E8F0_3px,#FFFFFF_3px,#FFFFFF_6px)]" />
          not enough data
        </span>
      </div>
    </figure>
  );
}
