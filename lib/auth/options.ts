/**
 * Auth.js (NextAuth v4) configuration — Stage 2.1.
 *
 * **Staff-only.** There is no public sign-up and no OAuth: the only provider is
 * Credentials, and accounts exist solely because a Super Admin created one in
 * `/admin/users` (or `npm run seed` did). Self-service registration and the
 * Google button were removed — the public site never exposed sign-in, so the
 * member area was surface with no users behind it.
 *
 * Strategy is JWT (required by the Credentials provider and keeps middleware
 * DB-free). The user's `id`, `role`, and `status` are written onto the token in
 * the `jwt` callback and mirrored onto the session in `session`, so server
 * components, route handlers, and the Edge middleware all authorize from the
 * token alone.
 *
 * There is intentionally **no** database adapter: with JWT sessions the single
 * Mongoose `User` collection stays the source of truth for roles.
 *
 * Brute-force throttling lives in `authorize` (see `lib/auth/login-throttle`):
 * NextAuth owns this endpoint, so the guard can't sit in a route handler.
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { dbConnect } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  clearLoginFailures,
  ipFromAuthRequest,
  recordLoginFailure,
  throttleLogin,
} from "@/lib/auth/login-throttle";
import { User } from "@/models/user";
import { signInSchema } from "@/lib/validation/user";
import type { UserRole, UserStatus } from "@/lib/enums";

/** Auth-error codes surfaced to the sign-in UI (kept in sync with sign-in copy). */
export const AUTH_ERRORS = {
  invalidCredentials: "InvalidCredentials",
  emailNotVerified: "EmailNotVerified",
  accountSuspended: "AccountSuspended",
  tooManyAttempts: "TooManyAttempts",
} as const;

interface AuthUserFields {
  id: string;
  role: UserRole;
  status: UserStatus;
}

/**
 * Load the role/status/id we cache on the token, by email. Used to refresh the
 * JWT on `update` (e.g. after a role change in the admin panel).
 */
async function loadAuthFields(email: string): Promise<AuthUserFields | null> {
  await dbConnect();
  const user = await User.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  })
    .select("_id role status")
    .lean();
  if (!user) return null;
  return { id: String(user._id), role: user.role, status: user.status };
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/sign-in",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) throw new Error(AUTH_ERRORS.invalidCredentials);
        const { email, password } = parsed.data;

        // Throttle before touching the database, so a flood costs the attacker
        // more than it costs us. Counts failures only — see login-throttle.
        const ip = ipFromAuthRequest(req);
        if (await throttleLogin(ip, email)) {
          throw new Error(AUTH_ERRORS.tooManyAttempts);
        }

        await dbConnect();
        const user = await User.findOne({ email, isDeleted: false }).select(
          "+passwordHash email name role status emailVerified",
        );

        // Use a constant message for both "no user" and "no/wrong password" so
        // the form never reveals which emails are registered.
        if (!user?.passwordHash) {
          await recordLoginFailure(ip, email);
          throw new Error(AUTH_ERRORS.invalidCredentials);
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          await recordLoginFailure(ip, email);
          throw new Error(AUTH_ERRORS.invalidCredentials);
        }

        if (user.status === "suspended") {
          throw new Error(AUTH_ERRORS.accountSuspended);
        }
        if (!user.emailVerified) {
          throw new Error(AUTH_ERRORS.emailNotVerified);
        }

        await clearLoginFailures(ip, email);

        user.lastLoginAt = new Date();
        await user.save();

        return {
          id: String(user._id),
          email: user.email,
          name: user.name ?? null,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign-in via Credentials: `user` carries our fields.
      if (user) {
        token.id = user.id;
        if (user.role) token.role = user.role;
        if (user.status) token.status = user.status;
      }

      // Refresh cached claims when the client calls `useSession().update()`
      // (e.g. after a role/status change in the admin panel).
      if (trigger === "update" && token.email) {
        const fields = await loadAuthFields(token.email);
        if (fields) {
          token.id = fields.id;
          token.role = fields.role;
          token.status = fields.status;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = (token.role ?? "member") as UserRole;
        session.user.status = (token.status ?? "active") as UserStatus;
      }
      return session;
    },
  },
};
