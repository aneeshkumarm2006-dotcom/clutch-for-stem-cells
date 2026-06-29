"use client";

/**
 * Client wrapper around NextAuth's SessionProvider — Stage 2.1.
 *
 * Mounted in the root layout so client components (navbar, sign-out, account UI)
 * can call `useSession()`. Server Components should use `getCurrentUser()` from
 * `lib/auth` instead.
 */
import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
