/**
 * Auth.js (NextAuth v4) configuration — Stage 2.1.
 *
 * Providers: Credentials (email/password) + Google OAuth. Strategy is JWT
 * (required by the Credentials provider and keeps middleware DB-free). The
 * user's `id`, `role`, and `status` are written onto the token in the `jwt`
 * callback and mirrored onto the session in `session`, so server components,
 * route handlers, and the Edge middleware all authorize from the token alone.
 *
 * There is intentionally **no** database adapter: with JWT sessions we persist
 * the `User` record ourselves (credentials in the register route; Google in the
 * `signIn` callback below) which keeps the single Mongoose `User` collection as
 * the source of truth for roles.
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { dbConnect } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { User } from "@/models/user";
import { signInSchema } from "@/lib/validation/user";
import type { UserRole, UserStatus } from "@/lib/enums";

/** Auth-error codes surfaced to the sign-in UI (kept in sync with sign-in copy). */
export const AUTH_ERRORS = {
  invalidCredentials: "InvalidCredentials",
  emailNotVerified: "EmailNotVerified",
  accountSuspended: "AccountSuspended",
} as const;

interface AuthUserFields {
  id: string;
  role: UserRole;
  status: UserStatus;
}

/**
 * Load the role/status/id we cache on the token, by email. Used to enrich the
 * JWT for Google sign-ins (whose `user` object is the OAuth profile, not our
 * record) and to refresh the token on `update`.
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

/** Whether Google OAuth is configured (drives the "Continue with Google" UI). */
export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

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
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) throw new Error(AUTH_ERRORS.invalidCredentials);
        const { email, password } = parsed.data;

        await dbConnect();
        const user = await User.findOne({ email, isDeleted: false }).select(
          "+passwordHash email name role status emailVerified",
        );

        // Use a constant message for both "no user" and "no/wrong password" so
        // the form never reveals which emails are registered.
        if (!user?.passwordHash)
          throw new Error(AUTH_ERRORS.invalidCredentials);

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) throw new Error(AUTH_ERRORS.invalidCredentials);

        if (user.status === "suspended") {
          throw new Error(AUTH_ERRORS.accountSuspended);
        }
        if (!user.emailVerified) {
          throw new Error(AUTH_ERRORS.emailNotVerified);
        }

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
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    /**
     * Google sign-in has no adapter, so we upsert the `User` here. A Google
     * email is provider-verified, so we mark `emailVerified`. Suspended accounts
     * are refused.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;

      await dbConnect();
      const existing = await User.findOne({ email }).select(
        "status provider emailVerified name avatar",
      );

      if (existing) {
        // Returning a URL string redirects there with our precise error code,
        // instead of NextAuth's generic `AccessDenied`.
        if (existing.status === "suspended") {
          return "/auth/sign-in?error=AccountSuspended";
        }
        const patch: Record<string, unknown> = { lastLoginAt: new Date() };
        if (!existing.emailVerified) patch.emailVerified = new Date();
        if (!existing.name && user.name) patch.name = user.name;
        await existing.updateOne(patch);
        return true;
      }

      await User.create({
        email,
        name: user.name ?? (profile as { name?: string })?.name,
        role: "member",
        status: "active",
        provider: "google",
        emailVerified: new Date(),
        avatar: user.image ? { url: user.image } : undefined,
        lastLoginAt: new Date(),
      });
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Initial sign-in via Credentials: `user` carries our fields.
      if (user) {
        token.id = user.id;
        if (user.role) token.role = user.role;
        if (user.status) token.status = user.status;
      }

      // Google: `user` is the OAuth profile (no role) — read our record.
      if (account?.provider === "google" && token.email) {
        const fields = await loadAuthFields(token.email);
        if (fields) {
          token.id = fields.id;
          token.role = fields.role;
          token.status = fields.status;
        }
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
