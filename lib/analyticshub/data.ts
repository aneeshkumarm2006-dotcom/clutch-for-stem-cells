/**
 * Data orchestration — resolve a source (or all) for a date range with a
 * 6-hour cache, per-source failure isolation, and reconnect-needed health
 * flags. Every source fetch is wrapped so one dead token never touches another
 * source. `refresh=1` busts the cache; connect/disconnect bust it too.
 */
import { daysBetween, parseRange, previousRange } from "@/lib/analyticshub/dates";
import { isHubError } from "@/lib/analyticshub/errors";
import { getGoogleAccessToken, refreshOtherToken } from "@/lib/analyticshub/google";
import { K } from "@/lib/analyticshub/keys";
import { json, type HubContext, type HubRequest, type HubResponse } from "@/lib/analyticshub/respond";
import { fetchGa4 } from "@/lib/analyticshub/sources/ga4";
import { fetchGads } from "@/lib/analyticshub/sources/gads";
import { fetchGsc } from "@/lib/analyticshub/sources/gsc";
import { fetchMeta } from "@/lib/analyticshub/sources/meta";
import { delPrefix, getJSON, setJSON, type HubStore } from "@/lib/analyticshub/store";
import type {
  DateRange,
  GadsConfig,
  GoogleConfig,
  MetaConfig,
  SourceId,
  SourceResult,
  SourceStatus,
} from "@/lib/analyticshub/types";
import { SOURCE_IDS } from "@/lib/analyticshub/types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  at: number;
  result: SourceResult;
}

function empty(
  source: SourceId,
  status: SourceStatus,
  error?: string,
): SourceResult {
  return { source, status, series: [], totals: {}, error };
}

function emptyUsers(range: DateRange): SourceResult {
  return {
    source: "users",
    status: "ok",
    series: daysBetween(range.from, range.to).map((date) => ({
      source: "users",
      metric: "signups",
      date,
      value: 0,
    })),
    totals: { total: 0, signups: 0 },
    detail: [
      {
        id: "recent",
        title: "Recent signups",
        columns: ["Name", "Email", "Source", "Joined"],
        rows: [],
      },
    ],
  };
}

function healthKey(source: SourceId): string | null {
  if (source === "ga4" || source === "gsc") return K.healthGoogle;
  if (source === "meta") return K.healthMeta;
  if (source === "gads") return K.healthGads;
  return null;
}

export async function bustSourceCache(
  store: HubStore,
  source: SourceId,
): Promise<void> {
  await delPrefix(store, K.cachePrefix(source));
}

async function fetchOne(
  ctx: HubContext,
  source: SourceId,
  range: DateRange,
): Promise<SourceResult> {
  switch (source) {
    case "users":
      return ctx.fetchUsers ? ctx.fetchUsers(range) : emptyUsers(range);
    case "ga4": {
      const cfg = await getJSON<GoogleConfig>(ctx.store, K.google);
      if (!cfg?.ga4PropertyId) return empty("ga4", "not_connected");
      const token = await getGoogleAccessToken(ctx.store, cfg, ctx.now);
      return fetchGa4(token, cfg.ga4PropertyId, range);
    }
    case "gsc": {
      const cfg = await getJSON<GoogleConfig>(ctx.store, K.google);
      if (!cfg?.gscSiteUrl) return empty("gsc", "not_connected");
      const token = await getGoogleAccessToken(ctx.store, cfg, ctx.now);
      return fetchGsc(token, cfg.gscSiteUrl, range);
    }
    case "meta": {
      const cfg = await getJSON<MetaConfig>(ctx.store, K.meta);
      if (!cfg) return empty("meta", "not_connected");
      return fetchMeta(cfg.accessToken, cfg.adAccountId, range);
    }
    case "gads": {
      const cfg = await getJSON<GadsConfig>(ctx.store, K.gads);
      if (!cfg) return empty("gads", "not_connected");
      const token = await refreshOtherToken(
        cfg.clientId,
        cfg.clientSecret,
        cfg.refreshToken,
      );
      return fetchGads(cfg, token, range);
    }
  }
}

/** Resolve one source with cache + isolation. Never throws. */
export async function getSource(
  ctx: HubContext,
  source: SourceId,
  range: DateRange,
  refresh: boolean,
): Promise<SourceResult> {
  const cacheKey = K.cache(source, range.from, range.to);
  if (!refresh) {
    const cached = await getJSON<CacheEntry>(ctx.store, cacheKey).catch(
      () => null,
    );
    if (cached && ctx.now - cached.at < CACHE_TTL_MS) return cached.result;
  }
  try {
    const result = await fetchOne(ctx, source, range);
    if (result.status === "ok") {
      const hk = healthKey(source);
      if (hk) await ctx.store.del(hk).catch(() => {});
      await setJSON(ctx.store, cacheKey, {
        at: ctx.now,
        result,
      } satisfies CacheEntry).catch(() => {});
    }
    return result;
  } catch (err) {
    const reconnect = isHubError(err) && err.code === "reconnect_needed";
    if (reconnect) {
      const hk = healthKey(source);
      if (hk) await ctx.store.set(hk, "reconnect_needed").catch(() => {});
    }
    return {
      source,
      status: reconnect ? "reconnect_needed" : "error",
      series: [],
      totals: {},
      error: isHubError(err)
        ? err.message
        : "Unexpected error fetching this source.",
    };
  }
}

async function fetchMany(
  ctx: HubContext,
  range: DateRange,
  refresh: boolean,
): Promise<Record<string, SourceResult>> {
  const results = await Promise.all(
    SOURCE_IDS.map((s) => getSource(ctx, s, range, refresh)),
  );
  const map: Record<string, SourceResult> = {};
  SOURCE_IDS.forEach((s, i) => {
    map[s] = results[i]!;
  });
  return map;
}

/** GET /data/<source|all>?from&to[&refresh=1] — returns current + previous. */
export async function dataRoute(
  rest: string[],
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const target = rest[0] ?? "all";
  const range = parseRange(req.query, ctx.now);
  const prev = previousRange(range.from, range.to);
  const refresh = req.query.get("refresh") === "1";

  if (target === "all") {
    const [current, previous] = await Promise.all([
      fetchMany(ctx, range, refresh),
      fetchMany(ctx, prev, refresh),
    ]);
    return json(200, { range, previousRange: prev, current, previous });
  }

  if (!SOURCE_IDS.includes(target as SourceId)) {
    return json(404, { error: "Unknown source.", code: "not_found" });
  }
  const source = target as SourceId;
  const [current, previous] = await Promise.all([
    getSource(ctx, source, range, refresh),
    getSource(ctx, source, prev, refresh),
  ]);
  return json(200, { range, previousRange: prev, current, previous });
}
