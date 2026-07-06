/**
 * Connection flows for the external sources. Every save performs a LIVE
 * validation call first (probe report / account read / 1-row query) — a
 * credential that fails validation is never stored, and the provider's own
 * error is surfaced verbatim. Each successful connect/disconnect busts that
 * source's cache and clears its reconnect flag.
 */
import { bustSourceCache } from "@/lib/analyticshub/data";
import { parseRange } from "@/lib/analyticshub/dates";
import { googleOAuthConfigured } from "@/lib/analyticshub/env";
import { HubError } from "@/lib/analyticshub/errors";
import {
  buildAuthUrl,
  exchangeCode,
  getGoogleAccessToken,
  mintOAuthState,
  refreshOtherToken,
  verifyOAuthState,
} from "@/lib/analyticshub/google";
import { K } from "@/lib/analyticshub/keys";
import {
  json,
  redirect,
  type HubContext,
  type HubRequest,
  type HubResponse,
} from "@/lib/analyticshub/respond";
import { listGa4Properties, probeGa4 } from "@/lib/analyticshub/sources/ga4";
import { listGscSites, probeGsc } from "@/lib/analyticshub/sources/gsc";
import { listMetaAccounts, probeMeta } from "@/lib/analyticshub/sources/meta";
import { probeGads } from "@/lib/analyticshub/sources/gads";
import { getJSON, setJSON } from "@/lib/analyticshub/store";
import type {
  GadsConfig,
  GoogleConfig,
  GoogleServiceAccount,
  MetaConfig,
} from "@/lib/analyticshub/types";
import { asRecord, str } from "@/lib/analyticshub/util";

const settings = (ctx: HubContext, qs: string): HubResponse =>
  redirect(`${ctx.origin}/analyticshub/settings?${qs}`);

async function bustGoogle(ctx: HubContext): Promise<void> {
  await bustSourceCache(ctx.store, "ga4");
  await bustSourceCache(ctx.store, "gsc");
  await ctx.store.del(K.healthGoogle);
}

/* ── Google OAuth (browser redirects) ─────────────────────────────────────── */

export function googleStart(ctx: HubContext): HubResponse {
  if (!googleOAuthConfigured()) return settings(ctx, "google=unavailable");
  return redirect(buildAuthUrl(ctx.origin, mintOAuthState(ctx.now)));
}

export async function googleCallback(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  if (req.query.get("error")) return settings(ctx, "google=denied");
  const code = req.query.get("code");
  if (!code || !verifyOAuthState(req.query.get("state"), ctx.now)) {
    return settings(ctx, "google=badstate");
  }
  try {
    const tokens = await exchangeCode(ctx.origin, code, ctx.now);
    const existing = await getJSON<GoogleConfig>(ctx.store, K.google);
    const cfg: GoogleConfig = {
      mode: "oauth",
      tokens,
      ga4PropertyId: existing?.ga4PropertyId,
      gscSiteUrl: existing?.gscSiteUrl,
    };
    await setJSON(ctx.store, K.google, cfg);
    await bustGoogle(ctx);
    return settings(ctx, "google=connected");
  } catch (err) {
    const msg = err instanceof HubError ? err.message : "Google connect failed.";
    return settings(ctx, `google=error&msg=${encodeURIComponent(msg)}`);
  }
}

/* ── Google JSON APIs (from Settings) ─────────────────────────────────────── */

export async function googleOptions(ctx: HubContext): Promise<HubResponse> {
  const cfg = await getJSON<GoogleConfig>(ctx.store, K.google);
  if (!cfg) return json(400, { error: "Connect Google first.", code: "bad_request" });
  const token = await getGoogleAccessToken(ctx.store, cfg, ctx.now);
  const [properties, sites] = await Promise.all([
    listGa4Properties(token),
    listGscSites(token),
  ]);
  return json(200, {
    properties,
    sites,
    selected: { ga4PropertyId: cfg.ga4PropertyId, gscSiteUrl: cfg.gscSiteUrl },
  });
}

export async function googleSelect(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const cfg = await getJSON<GoogleConfig>(ctx.store, K.google);
  if (!cfg) return json(400, { error: "Connect Google first.", code: "bad_request" });
  const body = asRecord(req.body) ?? {};
  const ga4PropertyId = str(body.ga4PropertyId);
  const gscSiteUrl = str(body.gscSiteUrl);
  if (!ga4PropertyId && !gscSiteUrl) {
    return json(422, { error: "Pick a property or a site.", code: "bad_request" });
  }
  const token = await getGoogleAccessToken(ctx.store, cfg, ctx.now);
  const probeWindow = parseRange(new URLSearchParams(), ctx.now);
  if (ga4PropertyId) await probeGa4(token, ga4PropertyId);
  if (gscSiteUrl) await probeGsc(token, gscSiteUrl, probeWindow);
  await setJSON(ctx.store, K.google, {
    ...cfg,
    ga4PropertyId: ga4PropertyId ?? cfg.ga4PropertyId,
    gscSiteUrl: gscSiteUrl ?? cfg.gscSiteUrl,
  });
  await bustGoogle(ctx);
  return json(200, { ok: true });
}

export async function googleServiceAccount(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const body = asRecord(req.body) ?? {};
  const sa = parseServiceAccount(body.key);
  const ga4PropertyId = str(body.ga4PropertyId);
  const gscSiteUrl = str(body.gscSiteUrl);
  if (!ga4PropertyId && !gscSiteUrl) {
    return json(422, {
      error: "Provide a GA4 property ID and/or a Search Console site URL.",
      code: "bad_request",
    });
  }
  const cfg: GoogleConfig = {
    mode: "service_account",
    serviceAccount: sa,
    ga4PropertyId,
    gscSiteUrl,
  };
  const token = await getGoogleAccessToken(ctx.store, cfg, ctx.now);
  const probeWindow = parseRange(new URLSearchParams(), ctx.now);
  if (ga4PropertyId) await probeGa4(token, ga4PropertyId);
  if (gscSiteUrl) await probeGsc(token, gscSiteUrl, probeWindow);
  await setJSON(ctx.store, K.google, cfg);
  await bustGoogle(ctx);
  return json(200, { ok: true });
}

function parseServiceAccount(raw: unknown): GoogleServiceAccount {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      throw new HubError(
        "bad_request",
        "The service-account key must be the JSON file's contents.",
        422,
      );
    }
  }
  const rec = asRecord(obj);
  const clientEmail = str(rec?.client_email);
  const privateKey = str(rec?.private_key);
  if (!clientEmail || !privateKey) {
    throw new HubError(
      "bad_request",
      "Service-account JSON is missing client_email or private_key.",
      422,
    );
  }
  return { clientEmail, privateKey };
}

export async function googleDisconnect(ctx: HubContext): Promise<HubResponse> {
  await ctx.store.del(K.google);
  await bustGoogle(ctx);
  return json(200, { ok: true });
}

/* ── Meta ─────────────────────────────────────────────────────────────────── */

export async function metaAccounts(req: HubRequest): Promise<HubResponse> {
  const token = str(asRecord(req.body)?.token);
  if (!token) return json(422, { error: "Paste your access token.", code: "bad_request" });
  const accounts = await listMetaAccounts(token);
  return json(200, { accounts });
}

export async function metaSelect(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const body = asRecord(req.body) ?? {};
  const token = str(body.token);
  const adAccountId = str(body.adAccountId);
  if (!token || !adAccountId) {
    return json(422, { error: "Token and ad account are required.", code: "bad_request" });
  }
  const accountName = await probeMeta(token, adAccountId);
  const cfg: MetaConfig = { accessToken: token, adAccountId, accountName };
  await setJSON(ctx.store, K.meta, cfg);
  await bustSourceCache(ctx.store, "meta");
  await ctx.store.del(K.healthMeta);
  return json(200, { ok: true, accountName });
}

export async function metaDisconnect(ctx: HubContext): Promise<HubResponse> {
  await ctx.store.del(K.meta);
  await ctx.store.del(K.healthMeta);
  await bustSourceCache(ctx.store, "meta");
  return json(200, { ok: true });
}

/* ── Google Ads ───────────────────────────────────────────────────────────── */

export async function gadsSave(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const body = asRecord(req.body) ?? {};
  const developerToken = str(body.developerToken);
  const clientId = str(body.clientId);
  const clientSecret = str(body.clientSecret);
  const refreshToken = str(body.refreshToken);
  const customerId = str(body.customerId)?.replace(/[^0-9]/g, "");
  const loginCustomerId = str(body.loginCustomerId)?.replace(/[^0-9]/g, "");
  if (!developerToken || !clientId || !clientSecret || !refreshToken || !customerId) {
    return json(422, {
      error:
        "Developer token, OAuth client ID/secret, refresh token, and customer ID are all required.",
      code: "bad_request",
    });
  }
  const cfg: GadsConfig = {
    developerToken,
    clientId,
    clientSecret,
    refreshToken,
    customerId,
    loginCustomerId,
  };
  const token = await refreshOtherToken(clientId, clientSecret, refreshToken);
  await probeGads(cfg, token);
  await setJSON(ctx.store, K.gads, cfg);
  await bustSourceCache(ctx.store, "gads");
  await ctx.store.del(K.healthGads);
  return json(200, { ok: true });
}

export async function gadsDisconnect(ctx: HubContext): Promise<HubResponse> {
  await ctx.store.del(K.gads);
  await ctx.store.del(K.healthGads);
  await bustSourceCache(ctx.store, "gads");
  return json(200, { ok: true });
}
