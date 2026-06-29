/**
 * NextAuth module augmentation — Stage 2.1.
 *
 * Adds the StemConnect `id`, `role`, and `status` claims to the session, the
 * authorize() user, and the JWT so server code and middleware can authorize
 * without a DB round-trip. Roles come from the shared enum (`lib/enums`).
 */
import type { DefaultSession } from "next-auth";
import type { UserRole, UserStatus } from "@/lib/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
    } & DefaultSession["user"];
  }

  /** Shape returned by the Credentials `authorize` callback / Google profile. */
  interface User {
    id: string;
    role?: UserRole;
    status?: UserStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    status?: UserStatus;
  }
}
