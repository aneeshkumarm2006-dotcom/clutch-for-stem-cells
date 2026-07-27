/**
 * GA4 — Data API `runReport` (daily metrics + top-N) and Admin API
 * `accountSummaries` (property picker). Raw fetch, no SDK. Token is resolved by
 * the caller (google.ts) and passed in.
 */
import { daysBetween, fromCompactDay } from "@/lib/analyticshub/dates";
import { HubError } from "@/lib/analyticshub/errors";
import { fetchJson } from "@/lib/analyticshub/http";
import type {
  DateRange,
  DetailTable,
  SeriesPoint,
  SourceResult,
} from "@/lib/analyticshub/types";

const DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";
const ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";

/** Metric api-name → normalized key. */
const METRICS: { api: string; key: string }[] = [
  { api: "sessions", key: "sessions" },
  { api: "totalUsers", key: "totalUsers" },
  { api: "newUsers", key: "newUsers" },
  { api: "engagedSessions", key: "engagedSessions" },
  { api: "keyEvents", key: "keyEvents" },
  { api: "userEngagementDuration", key: "engagementTime" },
];

interface ReportRow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}
interface RunReportResponse {
  rows?: ReportRow[];
}
interface PropertySummary {
  property?: string;
  displayName?: string;
}
interface AccountSummary {
  displayName?: string;
  propertySummaries?: PropertySummary[];
}
interface AccountSummariesResponse {
  accountSummaries?: AccountSummary[];
}

export interface Ga4Property {
  id: string;
  name: string;
  account: string;
}

const toNum = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function runReport(
  token: string,
  propertyId: string,
  body: unknown,
): Promise<RunReportResponse> {
  const res = await fetchJson<RunReportResponse>(
    `${DATA_BASE}/properties/${encodeURIComponent(propertyId)}:runReport`,
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
      res.errorText ?? "GA4 report request failed.",
      res.status || 400,
    );
  }
  return res.data ?? {};
}

/** List GA4 properties the credential can see (Admin API), for the dropdown. */
export async function listGa4Properties(token: string): Promise<Ga4Property[]> {
  const res = await fetchJson<AccountSummariesResponse>(
    `${ADMIN_BASE}/accountSummaries?pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new HubError(
      "provider_error",
      res.errorText ?? "Could not list GA4 properties.",
      res.status || 400,
    );
  }
  const out: Ga4Property[] = [];
  for (const acc of res.data?.accountSummaries ?? []) {
    for (const p of acc.propertySummaries ?? []) {
      if (!p.property) continue;
      out.push({
        id: p.property.replace("properties/", ""),
        name: p.displayName ?? p.property,
        account: acc.displayName ?? "",
      });
    }
  }
  return out;
}

/** 1-row probe used to validate a property selection before saving. */
export async function probeGa4(token: string, propertyId: string): Promise<void> {
  await runReport(token, propertyId, {
    dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
    metrics: [{ name: "sessions" }],
    limit: 1,
  });
}

async function topReport(
  token: string,
  propertyId: string,
  range: DateRange,
  dimension: string,
  metric: string,
  title: string,
  columns: string[],
  id: string,
): Promise<DetailTable> {
  const rep = await runReport(token, propertyId, {
    dateRanges: [{ startDate: range.from, endDate: range.to }],
    dimensions: [{ name: dimension }],
    metrics: [{ name: metric }],
    orderBys: [{ metric: { metricName: metric }, desc: true }],
    limit: 10,
  });
  const rows = (rep.rows ?? []).map((r) => [
    r.dimensionValues?.[0]?.value ?? "–",
    toNum(r.metricValues?.[0]?.value),
  ]);
  return { id, title, columns, rows };
}

export async function fetchGa4(
  token: string,
  propertyId: string,
  range: DateRange,
): Promise<SourceResult> {
  const daily = await runReport(token, propertyId, {
    dateRanges: [{ startDate: range.from, endDate: range.to }],
    dimensions: [{ name: "date" }],
    metrics: METRICS.map((m) => ({ name: m.api })),
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 100000,
  });

  const byDate = new Map<string, Record<string, number>>();
  for (const row of daily.rows ?? []) {
    const compact = row.dimensionValues?.[0]?.value ?? "";
    if (compact.length !== 8) continue;
    const rec: Record<string, number> = {};
    METRICS.forEach((m, i) => {
      rec[m.key] = toNum(row.metricValues?.[i]?.value);
    });
    byDate.set(fromCompactDay(compact), rec);
  }

  const series: SeriesPoint[] = [];
  const totals: Record<string, number> = {};
  for (const m of METRICS) totals[m.key] = 0;
  for (const date of daysBetween(range.from, range.to)) {
    const rec = byDate.get(date);
    for (const m of METRICS) {
      const value = rec?.[m.key] ?? 0;
      series.push({ source: "ga4", metric: m.key, date, value });
      totals[m.key] += value;
    }
  }
  // Present engagement time as an average per session (seconds).
  totals.avgEngagementTime =
    totals.sessions > 0
      ? Math.round(totals.engagementTime / totals.sessions)
      : 0;

  const [pages, sources] = await Promise.all([
    topReport(
      token,
      propertyId,
      range,
      "pagePath",
      "screenPageViews",
      "Top pages",
      ["Page", "Views"],
      "pages",
    ),
    topReport(
      token,
      propertyId,
      range,
      "sessionSource",
      "sessions",
      "Top sources",
      ["Source", "Sessions"],
      "sources",
    ),
  ]);

  return { source: "ga4", status: "ok", series, totals, detail: [pages, sources] };
}
