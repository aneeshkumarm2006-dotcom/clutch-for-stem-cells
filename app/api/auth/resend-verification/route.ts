/**
 * Resend verification email — Stage 2.2.
 *
 * Always responds with a generic success so the endpoint can't be used to probe
 * which emails are registered. Only re-sends for an existing, unverified,
 * credentials account.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import {
  createToken,
  expiryFromNow,
  EMAIL_VERIFICATION_TTL_HOURS,
} from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { resendVerificationSchema } from "@/lib/validation/user";
import { User } from "@/models/user";

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = resendVerificationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true });

  await dbConnect();
  const user = await User.findOne({
    email: parsed.data.email,
    isDeleted: false,
  }).select("emailVerified provider");

  if (user && !user.emailVerified && user.provider === "credentials") {
    const { token, tokenHash } = createToken();
    user.emailVerificationToken = tokenHash;
    user.emailVerificationExpires = expiryFromNow(EMAIL_VERIFICATION_TTL_HOURS);
    await user.save();
    try {
      await sendVerificationEmail(parsed.data.email, token);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Resend verification failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
