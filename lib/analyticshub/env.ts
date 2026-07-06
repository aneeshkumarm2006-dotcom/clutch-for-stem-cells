/**
 * Environment inspection for the hub — lazy reads only (never at module top).
 * The hub needs exactly one required secret (`ANALYTICSHUB_SECRET_KEY`) plus the
 * two shared Google OAuth values, which are optional (the service-account path
 * works without them).
 */
export const GOOGLE_REDIRECT_PATH = "/api/analyticshub/oauth/google/callback";

export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

export function googleOAuthClient(): { id: string; secret: string } | null {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

interface HeaderBag {
  get(name: string): string | null;
}

/**
 * Absolute origin for building the OAuth redirect URI. Prefers an explicit
 * `NEXT_PUBLIC_SITE_URL` / `NEXTAUTH_URL`, else derives from the request (Vercel
 * sets `x-forwarded-host` / `x-forwarded-proto`). Trailing slash stripped.
 */
export function originFromRequest(req: {
  headers: HeaderBag;
  url: string;
}): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}
