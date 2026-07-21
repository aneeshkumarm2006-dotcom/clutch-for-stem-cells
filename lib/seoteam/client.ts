/**
 * Client-side fetch helpers for the SEO Studio (`/api/seoteam/*`).
 *
 * Mirrors `lib/admin/client.ts`, with one addition tuned to how the Studio is
 * used: its session is a single shared-password cookie that expires (~7 days)
 * and can be invalidated while a long-lived, auto-saving editor tab stays open.
 * When that happens every save / publish / upload starts returning 401. Because
 * the editor is an SPA tab that never re-navigates, the middleware login-gate
 * never fires, so without help the user just sees a dead-end "Unauthorized."
 * toast with no way forward.
 *
 * These helpers fix that: a 401 from any Studio call bounces the browser to the
 * login screen with a `next=` pointer, so after re-authenticating the user lands
 * back exactly where they were.
 */

// Guard against several concurrent calls (auto-save + slug check + upload) all
// 401-ing at once and each trying to navigate.
let redirecting = false;

/** Send the browser to the Studio login, preserving the current location. */
export function redirectToSeoLogin(): void {
  if (typeof window === "undefined") return;
  if (redirecting) return;
  const { pathname, search } = window.location;
  if (pathname.startsWith("/seoteam/login")) return; // already there
  redirecting = true;
  const next = encodeURIComponent(pathname + search);
  window.location.assign(`/seoteam/login?next=${next}`);
}

/** Thrown after a 401 kicks off the login redirect, so callers stop cleanly. */
export class SeoSessionExpiredError extends Error {
  constructor() {
    super("Your session expired — taking you to sign in…");
    this.name = "SeoSessionExpiredError";
  }
}

/**
 * Low-level fetch for Studio endpoints. On 401 it redirects to login (and
 * throws {@link SeoSessionExpiredError}); otherwise it parses the `{error}`
 * envelope these routes return and throws a friendly `Error` on failure.
 */
export async function seoFetchRaw<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    redirectToSeoLogin();
    throw new SeoSessionExpiredError();
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* empty / non-JSON body */
  }

  if (!res.ok) {
    throw new Error(
      (payload as { error?: string } | null)?.error ??
        "Something went wrong. Try again.",
    );
  }
  return payload as T;
}

/**
 * JSON mutation helper — same ergonomics as `adminFetch` (sends/serializes JSON)
 * but with the Studio's 401 → re-login recovery baked in.
 */
export async function seoFetch<T = unknown>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  return seoFetchRaw<T>(url, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
}
