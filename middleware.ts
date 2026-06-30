/**
 * Route gating — Stage 2.3 + SEO-team dashboard.
 *
 * Runs on the Edge. Two independent auth systems share this gate:
 *
 *   /admin/*    → NextAuth JWT: Editor | Admin | SuperAdmin
 *   /account/*  → NextAuth JWT: any authenticated user
 *   /seoteam/*  → shared-password signed cookie (lib/seoteam/session.ts)
 *
 * This is the coarse, route-level gate; per-handler/module checks
 * (`requireRole`/`requireApiRole` for admin, `withSeoAuth` for the dashboard)
 * are still enforced inside server code — never trust this layer alone.
 *
 * It also applies a same-origin **CSRF guard** to state-changing `/api/*`
 * requests (Stage 9.4 / PRD §13). NextAuth manages its own CSRF, so
 * `/api/auth/*` is exempt.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { isAdminRole, type UserRole } from "@/lib/enums";
import { SEOTEAM_COOKIE, verifySessionToken } from "@/lib/seoteam/session";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** True when a cross-origin write should be blocked (forged request). */
function isCrossOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  // Browsers always send Origin on cross-origin writes; absent Origin
  // (server-to-server tools) isn't CSRF.
  if (!origin) return false;
  const host = req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  return originHost !== host;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;

  // ── /api/seoteam/* — shared-password session (401) + CSRF ──────────────────
  if (pathname.startsWith("/api/seoteam")) {
    if (UNSAFE_METHODS.has(req.method) && isCrossOrigin(req)) {
      return NextResponse.json(
        { error: "Cross-origin request blocked." },
        { status: 403 },
      );
    }
    // The login endpoint must be reachable while unauthenticated.
    if (!pathname.startsWith("/api/seoteam/login")) {
      const authed = await verifySessionToken(
        req.cookies.get(SEOTEAM_COOKIE)?.value,
      );
      if (!authed) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  // ── Other /api/* — CSRF same-origin guard for mutations ────────────────────
  if (pathname.startsWith("/api/")) {
    if (
      UNSAFE_METHODS.has(req.method) &&
      !pathname.startsWith("/api/auth/") && // NextAuth has its own CSRF token.
      isCrossOrigin(req)
    ) {
      return NextResponse.json(
        { error: "Cross-origin request blocked." },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  // ── /seoteam/* UI — shared-password signed cookie ──────────────────────────
  if (pathname.startsWith("/seoteam")) {
    const authed = await verifySessionToken(
      req.cookies.get(SEOTEAM_COOKIE)?.value,
    );
    if (pathname === "/seoteam/login") {
      // Already signed in? Skip the login screen.
      return authed
        ? NextResponse.redirect(new URL("/seoteam", req.url))
        : NextResponse.next();
    }
    if (!authed) {
      const login = new URL("/seoteam/login", req.url);
      login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  // ── /admin/* + /account/* — NextAuth JWT ───────────────────────────────────
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const signIn = new URL("/auth/sign-in", req.url);
    signIn.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(signIn);
  }

  if (token.status === "suspended") {
    const signIn = new URL("/auth/sign-in", req.url);
    signIn.searchParams.set("error", "AccountSuspended");
    return NextResponse.redirect(signIn);
  }

  if (pathname.startsWith("/admin") && !isAdminRole(token.role as UserRole)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/account/:path*",
    "/seoteam/:path*",
    "/api/:path*",
  ],
};
