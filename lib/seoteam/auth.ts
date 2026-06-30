/**
 * SEO-team auth — server-only helpers (Node runtime).
 *
 * The dashboard authenticates against a single shared password
 * (`SEO_DASHBOARD_PASSWORD`) compared in constant time, then issues a signed
 * cookie session (lib/seoteam/session.ts). This module is the server-side read
 * side: password verification and "is the current request authed?" for Server
 * Components and Route Handlers. Edge-side gating lives in `middleware.ts`.
 */
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { SEOTEAM_COOKIE, verifySessionToken } from "@/lib/seoteam/session";

/** `true` when the shared dashboard password is configured. */
export function isDashboardConfigured(): boolean {
  return Boolean(
    process.env.SEO_DASHBOARD_PASSWORD && process.env.SESSION_SECRET,
  );
}

/**
 * Constant-time check of `input` against `SEO_DASHBOARD_PASSWORD`. Both sides are
 * SHA-256 hashed first so the comparison is fixed-length (no length/short-circuit
 * timing leak). Returns `false` when the env var is unset.
 */
export function verifyDashboardPassword(input: string): boolean {
  const expected = process.env.SEO_DASHBOARD_PASSWORD;
  if (!expected) return false;
  const a = createHash("sha256").update(String(input)).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Verify the session cookie on the current request (Server Components/Routes). */
export async function isSeoAuthenticated(): Promise<boolean> {
  const token = cookies().get(SEOTEAM_COOKIE)?.value;
  return verifySessionToken(token);
}
