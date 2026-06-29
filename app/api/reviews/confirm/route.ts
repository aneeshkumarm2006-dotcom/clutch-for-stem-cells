/**
 * Review email confirmation `/api/reviews/confirm` (Stage 5.5 / PRD §6.4).
 *
 * Opening the emailed link marks the review email-verified so it enters the
 * moderation queue. The raw token is hashed and matched against the stored hash
 * + expiry (mirrors auth verification). Redirects to a thank-you state.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { Review } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get("token");
  const done = (status: "ok" | "invalid") =>
    NextResponse.redirect(
      new URL(`/reviews/new?confirmed=${status}`, req.url),
      302,
    );

  if (!token) return done("invalid");

  await dbConnect();
  const review = await Review.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationToken +emailVerificationExpires");

  if (!review) return done("invalid");

  review.emailVerifiedAt = new Date();
  review.verificationMethod = "email_confirmed";
  review.emailVerificationToken = undefined;
  review.emailVerificationExpires = undefined;
  await review.save();

  return done("ok");
}
