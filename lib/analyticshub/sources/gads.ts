/**
 * Google Ads — REST `googleAds:searchStream` (GAQL). Raw fetch, no SDK. Google
 * Ads has its own OAuth client (developer token + client id/secret + refresh
 * token), independent of the shared GA4 OAuth app. Access token is minted by
 * the caller via `refreshOtherToken` and passed in.
 */
import { daysBetween } from "@/lib/analyticshub/dates";
import { HubError } from "@/lib/analyticshub/errors";
import { fetchJson } from "@/lib/analyticshub/http";
import type {
  DateRange,
  SeriesPoint,
  SourceResult,
  GadsConfig,
} from "@/lib/analyticshub/types";

const BASE = "https://googleads.googleapis.com/v18";

interface GadsRow {
  segments?: { date?: string };
  metrics?: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    conversions?: number;
    costPerConversion?: string;
  };
}
type SearchStreamResponse = { results?: GadsRow[] }[];

const toNum = (v: string | number | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function searchStream(
  cfg: GadsConfig,
  accessToken: string,
  gaql: string,
): Promise<GadsRow[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": cfg.developerToken,
    "Content-Type": "application/json",
  };
  if (cfg.loginCustomerId) headers["login-customer-id"] = cfg.loginCustomerId;
  const res = await fetchJson<SearchStreamResponse>(
    `${BASE}/customers/${encodeURIComponent(cfg.customerId)}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query: gaql }) },
  );
  if (!res.ok) {
    throw new HubError(
      "provider_error",
      res.errorText ?? "Google Ads query failed.",
      res.status || 400,
    );
  }
  const batches = Array.isArray(res.data) ? res.data : [];
  return batches.flatMap((b) => b.results ?? []);
}

/** 1-row probe to validate credentials before saving. */
export async function probeGads(
  cfg: GadsConfig,
  accessToken: string,
): Promise<void> {
  await searchStream(cfg, accessToken, "SELECT customer.id FROM customer LIMIT 1");
}

export async function fetchGads(
  cfg: GadsConfig,
  accessToken: string,
  range: DateRange,
): Promise<SourceResult> {
  const gaql =
    "SELECT segments.date, metrics.cost_micros, metrics.impressions, " +
    "metrics.clicks, metrics.conversions, metrics.cost_per_conversion " +
    `FROM customer WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'`;
  const rows = await searchStream(cfg, accessToken, gaql);

  const byDate = new Map<string, { cost: number; impressions: number; clicks: number; conversions: number }>();
  for (const row of rows) {
    const date = row.segments?.date;
    if (!date) continue;
    const prev = byDate.get(date) ?? {
      cost: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
    };
    prev.cost += toNum(row.metrics?.costMicros) / 1_000_000;
    prev.impressions += toNum(row.metrics?.impressions);
    prev.clicks += toNum(row.metrics?.clicks);
    prev.conversions += toNum(row.metrics?.conversions);
    byDate.set(date, prev);
  }

  const metricKeys = ["cost", "impressions", "clicks", "conversions", "costPerConversion"];
  const series: SeriesPoint[] = [];
  const totals: Record<string, number> = {};
  for (const k of metricKeys) totals[k] = 0;

  for (const date of daysBetween(range.from, range.to)) {
    const r = byDate.get(date);
    const cost = round(r?.cost ?? 0, 2);
    const impressions = r?.impressions ?? 0;
    const clicks = r?.clicks ?? 0;
    const conversions = round(r?.conversions ?? 0, 2);
    const costPerConversion = conversions > 0 ? round(cost / conversions, 2) : 0;
    series.push({ source: "gads", metric: "cost", date, value: cost });
    series.push({ source: "gads", metric: "impressions", date, value: impressions });
    series.push({ source: "gads", metric: "clicks", date, value: clicks });
    series.push({ source: "gads", metric: "conversions", date, value: conversions });
    series.push({
      source: "gads",
      metric: "costPerConversion",
      date,
      value: costPerConversion,
    });
    totals.cost += cost;
    totals.impressions += impressions;
    totals.clicks += clicks;
    totals.conversions += conversions;
  }
  totals.cost = round(totals.cost, 2);
  totals.conversions = round(totals.conversions, 2);
  totals.costPerConversion =
    totals.conversions > 0 ? round(totals.cost / totals.conversions, 2) : 0;

  return { source: "gads", status: "ok", series, totals };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
