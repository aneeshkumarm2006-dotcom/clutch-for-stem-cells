/**
 * NextAuth route handler — Stage 2.1.
 *
 * Serves every `/api/auth/*` endpoint (sign-in, callback, csrf, session, …).
 * The shared `authOptions` live in `lib/auth/options` so server helpers and
 * middleware reuse the same configuration.
 */
import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth/options";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
