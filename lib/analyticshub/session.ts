/**
 * Hub session cookie — a stateless HMAC-signed token for the single principal
 * (the owner). Token shape is `base64url(payloadJson).base64url(hmacSha256)`,
 * keyed by the HKDF-derived session key (`crypto.ts`).
 *
 * Node runtime only: the hub self-gates inside its Node route handler, not in
 * Edge middleware, so `node:crypto` is fine (no Web-Crypto constraint). 30-day
 * expiry, httpOnly + SameSite=Lax + Secure (prod).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { getSessionHmacKey } from "@/lib/analyticshub/crypto";

export const HUB_COOKIE = "analyticshub_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SUBJECT = "analyticshub-owner";

interface SessionPayload {
  sub: string;
  exp: number;
}

function sign(data: string): Buffer {
  return createHmac("sha256", getSessionHmacKey()).update(data).digest();
}

export function createSessionToken(nowMs = Date.now()): string {
  const payload: SessionPayload = {
    sub: SUBJECT,
    exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
}

/** Verify signature + expiry. Never throws; returns false on any problem. */
export function verifySessionToken(
  token: string | undefined | null,
  nowMs = Date.now(),
): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const expected = sign(body);
    const provided = Buffer.from(sig, "base64url");
    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      return false;
    }
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (payload.sub !== SUBJECT) return false;
    return payload.exp > Math.floor(nowMs / 1000);
  } catch {
    return false;
  }
}

export interface CookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Build a `Set-Cookie` header value (avoids depending on NextResponse cookies). */
export function serializeCookie(
  name: string,
  value: string,
  opts: CookieOptions,
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    "SameSite=Lax",
  ];
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}
