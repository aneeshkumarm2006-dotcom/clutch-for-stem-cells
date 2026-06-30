/**
 * Route gating — Stage 2.3.
 *
 * Runs on the Edge and authorizes from the NextAuth JWT alone (no DB, no
 * Mongoose). This is the coarse, route-level gate; per-handler/module checks
 * (`requireRole` / `requireApiRole` in `lib/auth`) are still enforced inside
 * server code per PRD §3 — never trust this layer alone.
 *
 *   /admin/*    → Editor | Admin | SuperAdmin
 *   /account/*  → any authenticated user
 *
 * Unauthenticated users are bounced to sign-in with a `callbackUrl`; signed-in
 * users lacking the admin role are sent home; suspended accounts are rejected.
 *
 * It also applies a same-origin **CSRF guard** to state-changing `/api/*`
 * requests (Stage 9.4 / PRD §13). Plain Route Handlers — unlike Server Actions —
 * get no built-in CSRF token, so a cross-site form could otherwise POST with the
 * user's session cookie. We reject unsafe methods whose `Origin` doesn't match
 * the host. NextAuth manages its own CSRF, so `/api/auth/*` is exempt.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { isAdminRole, type UserRole } from "@/lib/enums";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;

  // ── CSRF same-origin guard for API mutations ──────────────────────────────
  if (pathname.startsWith("/api/")) {
    if (
      UNSAFE_METHODS.has(req.method) &&
      !pathname.startsWith("/api/auth/") // NextAuth has its own CSRF token.
    ) {
      const origin = req.headers.get("origin");
      // Browsers always send Origin on cross-origin writes; a mismatch is a
      // forged request. Absent Origin (server-to-server tools) isn't CSRF.
      if (origin) {
        const host = req.headers.get("host");
        let originHost: string | null = null;
        try {
          originHost = new URL(origin).host;
        } catch {
          originHost = null;
        }
        if (originHost !== host) {
          return NextResponse.json(
            { error: "Cross-origin request blocked." },
            { status: 403 },
          );
        }
      }
    }
    return NextResponse.next();
  }

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
  matcher: ["/admin/:path*", "/account/:path*", "/api/:path*"],
};
