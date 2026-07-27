/**
 * Google Search Console — Search Analytics `query` (daily metrics + top
 * queries) and `sites` list (site picker). Raw fetch, no SDK.
 *
 * CTR is stored as a percentage (0–100); position is the average rank. Totals
 * are derived from the daily rows, weighting average position by impressions.
 */
import { daysBetween } from "@/lib/analyticshub/dates";
import { HubError } from "@/lib/analyticshub/errors";
import { fetchJson } from "@/lib/analyticshub/http";
import type {
  DateRange,
  DetailTable,
  SeriesPoint,
  SourceResult,
} from "@/lib/analyticshub/types";

const BASE = "https://searchconsole.googleapis.com/webmasters/v3";

interface SaRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}
interface SaResponse {
  rows?: SaRow[];
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export async function listGscSites(token: string): Promise<GscSite[]> {
  const res = await fetchJson<{ siteEntry?: GscSite[] }>(`${BASE}/sites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new HubError(
      "provider_error",
      res.errorText ?? "Could not list Search Console sites.",
      res.status || 400,
    );
  }
  return res.data?.siteEntry ?? [];
}

async function query(
  token: string,
  siteUrl: string,
  body: unknown,
): Promise<SaResponse> {
  const res = await fetchJson<SaResponse>(
    `${BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new HubError(
      "provider_error",
      res.errorText ?? "Search Console query failed.",
      res.status || 400,
    );
  }
  return res.data ?? {};
}

export async function probeGsc(
  token: string,
  siteUrl: string,
  range: DateRange,
): Promise<void> {
  await query(token, siteUrl, {
    startDate: range.from,
    endDate: range.to,
    dimensions: ["date"],
    rowLimit: 1,
  });
}

export async function fetchGsc(
  token: string,
  siteUrl: string,
  range: DateRange,
): Promise<SourceResult> {
  const [daily, queries] = await Promise.all([
    query(token, siteUrl, {
      startDate: range.from,
      endDate: range.to,
      dimensions: ["date"],
      rowLimit: 1000,
    }),
    query(token, siteUrl, {
      startDate: range.from,
      endDate: range.to,
      dimensions: ["query"],
      rowLimit: 20,
    }),
  ]);

  const byDate = new Map<string, SaRow>();
  for (const r of daily.rows ?? []) {
    const date = r.keys?.[0];
    if (date) byDate.set(date, r);
  }

  const series: SeriesPoint[] = [];
  let sumClicks = 0;
  let sumImpr = 0;
  let weightedPos = 0;
  for (const date of daysBetween(range.from, range.to)) {
    const r = byDate.get(date);
    const clicks = r?.clicks ?? 0;
    const impressions = r?.impressions ?? 0;
    const ctr = (r?.ctr ?? 0) * 100;
    const position = r?.position ?? 0;
    series.push({ source: "gsc", metric: "clicks", date, value: clicks });
    series.push({
      source: "gsc",
      metric: "impressions",
      date,
      value: impressions,
    });
    series.push({ source: "gsc", metric: "ctr", date, value: round(ctr, 2) });
    series.push({
      source: "gsc",
      metric: "position",
      date,
      value: round(position, 1),
    });
    sumClicks += clicks;
    sumImpr += impressions;
    weightedPos += position * impressions;
  }

  const totals: Record<string, number> = {
    clicks: sumClicks,
    impressions: sumImpr,
    ctr: sumImpr > 0 ? round((sumClicks / sumImpr) * 100, 2) : 0,
    position: sumImpr > 0 ? round(weightedPos / sumImpr, 1) : 0,
  };

  const queryTable: DetailTable = {
    id: "queries",
    title: "Top queries",
    columns: ["Query", "Clicks", "Impressions", "CTR", "Position"],
    rows: (queries.rows ?? []).map((r) => [
      r.keys?.[0] ?? "–",
      r.clicks ?? 0,
      r.impressions ?? 0,
      `${round((r.ctr ?? 0) * 100, 1)}%`,
      round(r.position ?? 0, 1),
    ]),
  };

  return { source: "gsc", status: "ok", series, totals, detail: [queryTable] };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
