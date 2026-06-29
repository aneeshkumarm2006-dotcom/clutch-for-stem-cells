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
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { isAdminRole, type UserRole } from "@/lib/enums";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;
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
  matcher: ["/admin/:path*", "/account/:path*"],
};
