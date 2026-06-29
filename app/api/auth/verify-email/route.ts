/**
 * Email verification link target — Stage 2.2.
 *
 * GET `/api/auth/verify-email?token=…` — re-hashes the token, matches it against
 * the stored hash + expiry, marks the email verified, and redirects to sign-in.
 * Mutating on GET is intentional: this is a one-time link clicked from an inbox.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { User } from "@/models/user";

export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get("token");
  const invalid = NextResponse.redirect(
    new URL("/auth/sign-in?error=VerificationInvalid", req.url),
  );
  if (!token) return invalid;

  await dbConnect();
  const user = await User.findOne({
    emailVerificationToken: hashToken(token),
  }).select("+emailVerificationToken +emailVerificationExpires emailVerified");

  if (!user || !user.emailVerificationExpires) return invalid;
  if (user.emailVerificationExpires.getTime() < Date.now()) return invalid;

  user.emailVerified = new Date();
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return NextResponse.redirect(new URL("/auth/sign-in?verified=1", req.url));
}
