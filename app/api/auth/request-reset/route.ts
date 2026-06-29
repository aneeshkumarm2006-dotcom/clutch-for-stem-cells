/**
 * Request a password reset — Stage 2.2.
 *
 * Always returns a generic success ("if an account exists, a link is on its
 * way") so it can't be used to enumerate registered emails. A reset link is
 * only sent for an existing credentials account.
 *
 * Note: this also lets the seeded SuperAdmin (created without a password) set
 * one for the first time.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import {
  createToken,
  expiryFromNow,
  PASSWORD_RESET_TTL_HOURS,
} from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { passwordResetRequestSchema } from "@/lib/validation/user";
import { User } from "@/models/user";

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = passwordResetRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true });

  await dbConnect();
  const user = await User.findOne({
    email: parsed.data.email,
    isDeleted: false,
    status: "active",
  }).select("provider");

  // OAuth-only accounts have no password to reset; skip silently.
  if (user && user.provider !== "google") {
    const { token, tokenHash } = createToken();
    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = expiryFromNow(PASSWORD_RESET_TTL_HOURS);
    await user.save();
    try {
      await sendPasswordResetEmail(parsed.data.email, token);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Password reset email failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
