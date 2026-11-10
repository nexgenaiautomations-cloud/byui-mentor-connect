import { requireAdmin } from "@/lib/session";
import { applyFilters, parseFilters, resolveRange, toCsv } from "@/lib/reports";
import { loadReport } from "@/lib/reports-server";

// GET /api/admin/reports/csv?range=...&major=... — the filtered report as CSV.
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const range = resolveRange({ preset: params.range, from: params.from, to: params.to });
  const { rows } = await loadReport(range);
  const csv = toCsv(applyFilters(rows, parseFilters(params)));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ican-report-${range.from}-to-${range.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
