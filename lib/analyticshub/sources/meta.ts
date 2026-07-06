/**
 * Meta Ads — Graph API `me/adaccounts` (account picker) + `{account}/insights`
 * (daily metrics). Raw fetch, no SDK. The long-lived token is passed in.
 *
 * "results" is objective-dependent on Meta; we approximate it as the sum of the
 * common conversion action types, and read ROAS from `purchase_roas`.
 */
import { daysBetween } from "@/lib/analyticshub/dates";
import { HubError } from "@/lib/analyticshub/errors";
import { fetchJson } from "@/lib/analyticshub/http";
import type {
  DateRange,
  SeriesPoint,
  SourceResult,
} from "@/lib/analyticshub/types";

const BASE = "https://graph.facebook.com/v21.0";
const RESULT_ACTIONS = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "complete_registration",
  "offsite_conversion.fb_pixel_complete_registration",
]);

interface Action {
  action_type: string;
  value: string;
}
interface InsightRow {
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  actions?: Action[];
  purchase_roas?: { value: string }[];
}

export interface MetaAccount {
  id: string;
  name: string;
}

const toNum = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function listMetaAccounts(token: string): Promise<MetaAccount[]> {
  const res = await fetchJson<{ data?: { id: string; name?: string }[] }>(
    `${BASE}/me/adaccounts?fields=name&limit=200&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) {
    throw new HubError(
      "provider_error",
      res.errorText ??
        "Could not list Meta ad accounts. Check the token has the ads_read permission.",
      res.status || 400,
    );
  }
  return (res.data?.data ?? []).map((a) => ({ id: a.id, name: a.name ?? a.id }));
}

export async function probeMeta(
  token: string,
  accountId: string,
): Promise<string> {
  const res = await fetchJson<{ name?: string }>(
    `${BASE}/${encodeURIComponent(accountId)}?fields=name&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) {
    throw new HubError(
      "provider_error",
      res.errorText ?? "Meta rejected the token or account.",
      res.status || 400,
    );
  }
  return res.data?.name ?? accountId;
}

export async function fetchMeta(
  token: string,
  accountId: string,
  range: DateRange,
): Promise<SourceResult> {
  const timeRange = JSON.stringify({ since: range.from, until: range.to });
  const res = await fetchJson<{ data?: InsightRow[] }>(
    `${BASE}/${encodeURIComponent(accountId)}/insights?level=account&time_increment=1` +
      `&fields=spend,impressions,clicks,cpc,cpm,actions,purchase_roas` +
      `&time_range=${encodeURIComponent(timeRange)}&limit=500` +
      `&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) {
    throw new HubError(
      "provider_error",
      res.errorText ?? "Meta insights request failed.",
      res.status || 400,
    );
  }

  const byDate = new Map<string, InsightRow>();
  for (const row of res.data?.data ?? []) {
    if (row.date_start) byDate.set(row.date_start, row);
  }

  const metricKeys = ["spend", "impressions", "clicks", "cpc", "cpm", "results", "roas"];
  const series: SeriesPoint[] = [];
  const totals: Record<string, number> = {};
  for (const k of metricKeys) totals[k] = 0;

  for (const date of daysBetween(range.from, range.to)) {
    const row = byDate.get(date);
    const results = (row?.actions ?? [])
      .filter((a) => RESULT_ACTIONS.has(a.action_type))
      .reduce((sum, a) => sum + toNum(a.value), 0);
    const roas = toNum(row?.purchase_roas?.[0]?.value);
    const values: Record<string, number> = {
      spend: round(toNum(row?.spend), 2),
      impressions: toNum(row?.impressions),
      clicks: toNum(row?.clicks),
      cpc: round(toNum(row?.cpc), 2),
      cpm: round(toNum(row?.cpm), 2),
      results,
      roas: round(roas, 2),
    };
    for (const k of metricKeys) {
      series.push({ source: "meta", metric: k, date, value: values[k]! });
    }
    totals.spend += values.spend!;
    totals.impressions += values.impressions!;
    totals.clicks += values.clicks!;
    totals.results += results;
  }
  // Derive rate metrics from summed totals (averaging daily rates would lie).
  totals.cpc = totals.clicks > 0 ? round(totals.spend / totals.clicks, 2) : 0;
  totals.cpm =
    totals.impressions > 0
      ? round((totals.spend / totals.impressions) * 1000, 2)
      : 0;
  totals.roas = 0; // account-level ROAS needs revenue; left at 0 unless present
  const roasDays = daysBetween(range.from, range.to)
    .map((d) => toNum(byDate.get(d)?.purchase_roas?.[0]?.value))
    .filter((v) => v > 0);
  if (roasDays.length > 0) {
    totals.roas = round(
      roasDays.reduce((a, b) => a + b, 0) / roasDays.length,
      2,
    );
  }

  return { source: "meta", status: "ok", series, totals };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
