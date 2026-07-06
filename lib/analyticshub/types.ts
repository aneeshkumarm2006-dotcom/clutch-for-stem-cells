/**
 * Shared analytics types — the normalized shape every source maps into, plus
 * the per-source connection configs persisted (encrypted) in the config store.
 */
export type SourceId = "users" | "ga4" | "gsc" | "meta" | "gads";

export const SOURCE_IDS: SourceId[] = ["users", "ga4", "gsc", "meta", "gads"];

export type SourceStatus =
  | "ok"
  | "not_connected"
  | "reconnect_needed"
  | "error";

/** One daily data point in the normalized series. */
export interface SeriesPoint {
  source: SourceId;
  metric: string;
  date: string; // YYYY-MM-DD
  value: number;
}

/** A top-N detail table (e.g. GSC queries, GA4 pages). */
export interface DetailTable {
  id: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

/** The wrapper returned for every source fetch. */
export interface SourceResult {
  source: SourceId;
  status: SourceStatus;
  series: SeriesPoint[];
  totals: Record<string, number>;
  detail?: DetailTable[];
  error?: string;
  meta?: Record<string, unknown>;
}

export interface DateRange {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

/* ── Per-source connection configs (persisted encrypted) ─────────────────── */

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope?: string;
}

export interface GoogleServiceAccount {
  clientEmail: string;
  privateKey: string; // PEM
}

export interface GoogleConfig {
  mode: "oauth" | "service_account";
  tokens?: GoogleTokens;
  serviceAccount?: GoogleServiceAccount;
  ga4PropertyId?: string; // numeric id, no "properties/" prefix
  gscSiteUrl?: string; // e.g. "sc-domain:example.com" or "https://example.com/"
}

export interface MetaConfig {
  accessToken: string;
  adAccountId: string; // "act_123..."
  accountName?: string;
}

export interface GadsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string; // digits only, no dashes
  loginCustomerId?: string; // MCC, digits only
}

export interface ProjectConfig {
  name: string;
  primary: string; // hex
  accent: string; // hex
}

/* ── Status surface returned by GET /status ──────────────────────────────── */

export interface SourceStatusView {
  source: SourceId;
  status: SourceStatus;
  label?: string; // e.g. selected property / account
  detail?: string;
}

export interface HubStatusView {
  setup: boolean; // password has been created
  authed: boolean; // current request carries a valid session
  secretOk: boolean;
  dbOk: boolean;
  googleOAuthAvailable: boolean;
  project: ProjectConfig;
  sources: SourceStatusView[];
  problems: string[]; // operator-facing messages that name the fix
}
