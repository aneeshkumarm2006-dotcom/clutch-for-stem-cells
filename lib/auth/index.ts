/**
 * Server-side auth & RBAC helpers — Stage 2.4.
 *
 * `getCurrentUser` / `requireRole` for Server Components and pages (they
 * `redirect` on failure), plus `requireApiRole` for Route Handlers (throws an
 * `ApiAuthError` you convert to a 401/403 `Response`). All authorization is
 * derived from the JWT session — never from client-supplied role values.
 *
 * Roles (PRD §3): Visitor (unauthenticated) < Member < Provider < Editor <
 * Admin < SuperAdmin. Ranking + admin-set membership live in `lib/enums`.
 */
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth/options";
import { isAdminRole, roleAtLeast, type UserRole } from "@/lib/enums";

export { authOptions } from "@/lib/auth/options";

export type SessionUser = Session["user"];

/** The current session (or null). Cached per request by NextAuth. */
export function getServerAuthSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

/** The signed-in user, or null for visitors. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerAuthSession();
  return session?.user ?? null;
}

/** Pure rank check — `true` when `role` is at or above `min`. */
export function hasRole(
  role: UserRole | undefined | null,
  min: UserRole,
): boolean {
  return role != null && roleAtLeast(role, min);
}

export function canAccessAdmin(role: UserRole | undefined | null): boolean {
  return role != null && isAdminRole(role);
}

// ── Server Component / page guards (redirect on failure) ─────────────────────

/**
 * Require any authenticated, active user. Redirects visitors to sign-in.
 * `callbackUrl` returns them here after signing in.
 */
export async function requireUser(callbackUrl?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(callbackUrl));
  if (user.status === "suspended")
    redirect("/auth/sign-in?error=AccountSuspended");
  return user;
}

/**
 * Require `min` role or higher. Visitors go to sign-in; signed-in users without
 * the role are sent home (they have an account, just not the privilege).
 */
export async function requireRole(
  min: UserRole,
  callbackUrl?: string,
): Promise<SessionUser> {
  const user = await requireUser(callbackUrl);
  if (!hasRole(user.role, min)) redirect("/");
  return user;
}

function signInPath(callbackUrl?: string): string {
  return callbackUrl
    ? `/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/auth/sign-in";
}

/**
 * Coerce a (possibly array/undefined) query value into a safe relative path for
 * post-login redirects. Rejects absolute/protocol-relative URLs to prevent open
 * redirects; falls back to `/`.
 */
export function sanitizeCallbackUrl(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

// ── Route Handler guards (throw → convert to Response) ───────────────────────

/** Thrown by `requireApiRole`; map to a Response with {@link authErrorResponse}. */
export class ApiAuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

/** Require an authenticated, active user in a Route Handler. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiAuthError(401, "Sign in to continue.");
  if (user.status === "suspended") {
    throw new ApiAuthError(403, "This account is suspended.");
  }
  return user;
}

/** Require `min` role or higher in a Route Handler. */
export async function requireApiRole(min: UserRole): Promise<SessionUser> {
  const user = await requireApiUser();
  if (!hasRole(user.role, min)) {
    throw new ApiAuthError(403, "You don't have access to this resource.");
  }
  return user;
}

/**
 * Convert an {@link ApiAuthError} to a JSON `Response`; returns `null` for any
 * other error so callers can rethrow:
 *
 *   try { await requireApiRole("editor"); }
 *   catch (e) { const r = authErrorResponse(e); if (r) return r; throw e; }
 */
export function authErrorResponse(error: unknown): Response | null {
  if (error instanceof ApiAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
