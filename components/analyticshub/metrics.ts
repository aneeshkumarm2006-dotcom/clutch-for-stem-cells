/**
 * Metric registry — display metadata for every normalized metric key. Drives
 * KPI tiles, chart legends, formatting, and delta colouring (cost/position
 * metrics invert: down is good).
 */
import type { SourceId } from "@/lib/analyticshub/types";

export type MetricFormat =
  | "int"
  | "float1"
  | "float2"
  | "pct"
  | "currency"
  | "seconds"
  | "position";

export interface MetricDef {
  source: SourceId;
  key: string;
  label: string;
  format: MetricFormat;
  /** Cost / position metrics: a decrease is an improvement. */
  invertDelta?: boolean;
}

export const SOURCE_LABEL: Record<SourceId, string> = {
  users: "Users",
  ga4: "Analytics",
  gsc: "Search Console",
  meta: "Meta Ads",
  gads: "Google Ads",
};

export const SOURCE_ROUTE: Record<SourceId, string> = {
  users: "/analyticshub/users",
  ga4: "/analyticshub/ga4",
  gsc: "/analyticshub/gsc",
  meta: "/analyticshub/meta",
  gads: "/analyticshub/gads",
};

export const METRICS: MetricDef[] = [
  { source: "users", key: "signups", label: "Signups", format: "int" },

  { source: "ga4", key: "sessions", label: "Sessions", format: "int" },
  { source: "ga4", key: "totalUsers", label: "Total users", format: "int" },
  { source: "ga4", key: "newUsers", label: "New users", format: "int" },
  { source: "ga4", key: "engagedSessions", label: "Engaged sessions", format: "int" },
  { source: "ga4", key: "keyEvents", label: "Key events", format: "int" },
  { source: "ga4", key: "engagementTime", label: "Engagement time", format: "seconds" },

  { source: "gsc", key: "clicks", label: "Clicks", format: "int" },
  { source: "gsc", key: "impressions", label: "Impressions", format: "int" },
  { source: "gsc", key: "ctr", label: "CTR", format: "pct" },
  { source: "gsc", key: "position", label: "Avg position", format: "position", invertDelta: true },

  { source: "meta", key: "spend", label: "Spend", format: "currency", invertDelta: true },
  { source: "meta", key: "impressions", label: "Impressions", format: "int" },
  { source: "meta", key: "clicks", label: "Clicks", format: "int" },
  { source: "meta", key: "cpc", label: "CPC", format: "currency", invertDelta: true },
  { source: "meta", key: "cpm", label: "CPM", format: "currency", invertDelta: true },
  { source: "meta", key: "results", label: "Results", format: "int" },
  { source: "meta", key: "roas", label: "ROAS", format: "float2" },

  { source: "gads", key: "cost", label: "Cost", format: "currency", invertDelta: true },
  { source: "gads", key: "impressions", label: "Impressions", format: "int" },
  { source: "gads", key: "clicks", label: "Clicks", format: "int" },
  { source: "gads", key: "conversions", label: "Conversions", format: "float1" },
  { source: "gads", key: "costPerConversion", label: "Cost / conv.", format: "currency", invertDelta: true },
];

/** The headline metrics shown as KPI tiles + the fixed chart per source. */
export const KEY_METRICS: Record<SourceId, string[]> = {
  users: ["signups"],
  ga4: ["sessions", "totalUsers", "newUsers", "keyEvents"],
  gsc: ["clicks", "impressions", "ctr", "position"],
  meta: ["spend", "impressions", "clicks", "results"],
  gads: ["cost", "clicks", "conversions", "costPerConversion"],
};

export function metricsFor(source: SourceId): MetricDef[] {
  return METRICS.filter((m) => m.source === source);
}

export function metricDef(source: SourceId, key: string): MetricDef | undefined {
  return METRICS.find((m) => m.source === source && m.key === key);
}

export function metricIndex(source: SourceId, key: string): number {
  return metricsFor(source).findIndex((m) => m.key === key);
}
