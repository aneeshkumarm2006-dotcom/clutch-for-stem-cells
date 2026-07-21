/**
 * SEO-team session token — signed, stateless, Edge-safe.
 *
 * **Must stay Edge-compatible** (imported by `middleware.ts`): Web Crypto only,
 * no `node:*`, no Mongoose. The token is `base64url(payload).base64url(HMAC)`
 * where the HMAC-SHA256 is keyed by `SESSION_SECRET`. We verify the signature in
 * constant time and check expiry; there's no server-side session store (the
 * shared-password model has a single principal), so a valid signature ⇒ authed.
 *
 * The cookie that carries this token is set httpOnly + SameSite=Lax + Secure
 * (prod) by the login route; see {@link sessionCookieOptions}.
 */

export const SEOTEAM_COOKIE = "seoteam_session";

/** Session lifetime — ~7 days (PRD: "expires after ~7 days"). */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const SUBJECT = "seoteam";

export interface SessionPayload {
  sub: string;
  /** Expiry, epoch seconds. */
  exp: number;
}

// ── base64url (no padding) ────────────────────────────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const padLen = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── HMAC ──────────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

async function hmacSign(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(sig);
}

/** Constant-time byte comparison (no early return on first mismatch). */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// ── Secret ────────────────────────────────────────────────────────────────────

function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Mint a signed session token valid for {@link SESSION_TTL_SECONDS}. */
export async function createSessionToken(nowMs = Date.now()): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  const payload: SessionPayload = {
    sub: SUBJECT,
    exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS,
  };
  const payloadPart = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await hmacSign(secret, payloadPart);
  return `${payloadPart}.${bytesToBase64Url(sig)}`;
}

/**
 * Decode + verify a token: returns its payload only when the signature matches,
 * the subject is ours, and it hasn't expired. Returns `null` otherwise. Never
 * throws. This is the shared core behind {@link verifySessionToken} and the
 * sliding-renewal check in `middleware.ts`.
 */
export async function decodeSessionToken(
  token: string | undefined | null,
  nowMs = Date.now(),
): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = getSessionSecret();
  if (!secret) return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  try {
    const expected = await hmacSign(secret, payloadPart);
    const provided = base64UrlToBytes(sigPart);
    if (!timingSafeEqual(expected, provided)) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadPart)),
    ) as SessionPayload;
    if (payload.sub !== SUBJECT) return null;
    if (payload.exp <= Math.floor(nowMs / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify a session token's signature + expiry. Returns `true` only when the
 * signature matches and the token hasn't expired. Never throws.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  nowMs = Date.now(),
): Promise<boolean> {
  return (await decodeSessionToken(token, nowMs)) !== null;
}

/**
 * Sliding-renewal check: `true` when a still-valid token is past the halfway
 * point of its lifetime and should be re-issued so an actively-used session
 * never expires out from under the user mid-edit. `payload` is what
 * {@link decodeSessionToken} returned (already known-valid).
 */
export function sessionNeedsRenewal(
  payload: SessionPayload,
  nowMs = Date.now(),
): boolean {
  const nowSec = Math.floor(nowMs / 1000);
  const ageSec = SESSION_TTL_SECONDS - (payload.exp - nowSec);
  return ageSec >= SESSION_TTL_SECONDS / 2;
}

/** Cookie attributes for `Set-Cookie` (Secure in production only). */
export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
