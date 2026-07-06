/**
 * Google auth for GA4 + Search Console — raw fetch + `node:crypto`, no SDK.
 *
 * Two ways to get an access token:
 *   - OAuth: the shared `GOOGLE_OAUTH_*` web app, `access_type=offline` +
 *     `prompt=consent` (forces a refresh token even on re-grants). We refresh
 *     on demand and persist the rotated access token.
 *   - Service account: sign a JWT-bearer assertion (RS256, `createSign`) with
 *     the SA private key and exchange it for an access token.
 *
 * A revoked refresh token (`invalid_grant`) surfaces as a `reconnect_needed`
 * HubError so the source flips to "Reconnect needed" everywhere.
 */
import { createHmac, createSign, timingSafeEqual } from "node:crypto";

import { getSessionHmacKey } from "@/lib/analyticshub/crypto";
import { googleOAuthClient, GOOGLE_REDIRECT_PATH } from "@/lib/analyticshub/env";
import { HubError } from "@/lib/analyticshub/errors";
import { fetchJson } from "@/lib/analyticshub/http";
import { K } from "@/lib/analyticshub/keys";
import { setJSON, type HubStore } from "@/lib/analyticshub/store";
import type {
  GoogleConfig,
  GoogleServiceAccount,
  GoogleTokens,
} from "@/lib/analyticshub/types";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const STATE_TTL_SECONDS = 600; // 10 minutes

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

/* ── Signed OAuth state (CSRF for the redirect dance) ─────────────────────── */

export function mintOAuthState(nowMs: number): string {
  const body = Buffer.from(
    JSON.stringify({ n: "oauth", exp: Math.floor(nowMs / 1000) + STATE_TTL_SECONDS }),
  ).toString("base64url");
  const sig = createHmac("sha256", getSessionHmacKey())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string | null, nowMs: number): boolean {
  if (!state) return false;
  const dot = state.indexOf(".");
  if (dot <= 0) return false;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  try {
    const expected = createHmac("sha256", getSessionHmacKey())
      .update(body)
      .digest();
    const provided = Buffer.from(sig, "base64url");
    if (expected.length !== provided.length) return false;
    if (!timingSafeEqual(expected, provided)) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.n === "oauth" && payload.exp > Math.floor(nowMs / 1000);
  } catch {
    return false;
  }
}

/* ── OAuth URLs + exchanges ───────────────────────────────────────────────── */

export function buildAuthUrl(origin: string, state: string): string {
  const client = googleOAuthClient();
  if (!client) {
    throw new HubError(
      "provider_error",
      "Google sign-in is unavailable: set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET (or use the service-account path).",
      400,
    );
  }
  const params = new URLSearchParams({
    client_id: client.id,
    redirect_uri: `${origin}${GOOGLE_REDIRECT_PATH}`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCode(
  origin: string,
  code: string,
  nowMs: number,
): Promise<GoogleTokens> {
  const client = googleOAuthClient();
  if (!client) {
    throw new HubError("provider_error", "Google OAuth is not configured.", 400);
  }
  const res = await fetchJson<TokenResponse>(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.id,
      client_secret: client.secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origin}${GOOGLE_REDIRECT_PATH}`,
    }).toString(),
  });
  if (!res.ok || !res.data?.access_token) {
    throw new HubError(
      "provider_error",
      res.errorText ?? "Google rejected the authorization code.",
      400,
    );
  }
  if (!res.data.refresh_token) {
    throw new HubError(
      "provider_error",
      "Google did not return a refresh token. Remove this app's access at myaccount.google.com/permissions and try again (we request prompt=consent to force one).",
      400,
    );
  }
  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresAt: nowMs + res.data.expires_in * 1000,
    scope: res.data.scope,
  };
}

async function refreshAccessToken(
  refreshToken: string,
  nowMs: number,
): Promise<{ accessToken: string; expiresAt: number }> {
  const client = googleOAuthClient();
  if (!client) {
    throw new HubError("provider_error", "Google OAuth is not configured.", 400);
  }
  const res = await fetchJson<TokenResponse>(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.id,
      client_secret: client.secret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok || !res.data?.access_token) {
    const invalidGrant =
      res.status === 400 || /invalid_grant/i.test(res.errorText ?? "");
    throw new HubError(
      invalidGrant ? "reconnect_needed" : "provider_error",
      invalidGrant
        ? "Google refresh token was revoked. Reconnect Google in Settings."
        : (res.errorText ?? "Could not refresh the Google access token."),
      invalidGrant ? 401 : 400,
    );
  }
  return {
    accessToken: res.data.access_token,
    expiresAt: nowMs + res.data.expires_in * 1000,
  };
}

/* ── Service-account JWT-bearer (RS256) ───────────────────────────────────── */

function signServiceAccountJwt(
  sa: GoogleServiceAccount,
  nowSec: number,
): string {
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.clientEmail,
    scope: GOOGLE_SCOPES.join(" "),
    aud: TOKEN_ENDPOINT,
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const enc = (o: unknown): string =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(claim)}`;
  let signature: string;
  try {
    signature = createSign("RSA-SHA256")
      .update(signingInput)
      .sign(sa.privateKey, "base64url");
  } catch {
    throw new HubError(
      "provider_error",
      "Could not sign with the service-account private key. Paste the full JSON key file, including the private_key field.",
      400,
    );
  }
  return `${signingInput}.${signature}`;
}

async function serviceAccountToken(
  sa: GoogleServiceAccount,
  nowMs: number,
): Promise<string> {
  const jwt = signServiceAccountJwt(sa, Math.floor(nowMs / 1000));
  const res = await fetchJson<TokenResponse>(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok || !res.data?.access_token) {
    throw new HubError(
      "provider_error",
      res.errorText ??
        "Service-account token exchange failed. Check the key and that the GA4/Search Console APIs are enabled for its project.",
      400,
    );
  }
  return res.data.access_token;
}

/* ── The one call every GA4/GSC fetch uses ────────────────────────────────── */

/**
 * Resolve a valid access token for the stored Google config, refreshing an
 * expired OAuth token (and persisting it) or minting a fresh SA token.
 */
export async function getGoogleAccessToken(
  store: HubStore,
  cfg: GoogleConfig,
  nowMs: number,
): Promise<string> {
  if (cfg.mode === "service_account") {
    if (!cfg.serviceAccount) {
      throw new HubError("provider_error", "Service account is missing.", 400);
    }
    return serviceAccountToken(cfg.serviceAccount, nowMs);
  }
  if (!cfg.tokens) {
    throw new HubError("reconnect_needed", "Reconnect Google in Settings.", 401);
  }
  if (cfg.tokens.expiresAt > nowMs + 60_000) {
    return cfg.tokens.accessToken;
  }
  const refreshed = await refreshAccessToken(cfg.tokens.refreshToken, nowMs);
  const updated: GoogleConfig = {
    ...cfg,
    tokens: {
      ...cfg.tokens,
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
    },
  };
  await setJSON(store, K.google, updated);
  return refreshed.accessToken;
}

/** Standalone token exchange for another Google OAuth client (Google Ads). */
export async function refreshOtherToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetchJson<TokenResponse>(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok || !res.data?.access_token) {
    const invalidGrant = /invalid_grant/i.test(res.errorText ?? "");
    throw new HubError(
      invalidGrant ? "reconnect_needed" : "provider_error",
      invalidGrant
        ? "Google Ads refresh token was revoked. Re-generate it and save again."
        : (res.errorText ?? "Could not refresh the Google Ads token."),
      invalidGrant ? 401 : 400,
    );
  }
  return res.data.access_token;
}
