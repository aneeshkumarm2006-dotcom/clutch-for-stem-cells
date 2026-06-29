/**
 * Sign-up (credentials) — Stage 2.2.
 *
 * Creates an unverified Member, then emails a verification link. The account
 * cannot sign in until the email is verified (enforced in `authOptions`
 * `authorize`). PRD-ASSUMPTION: rate-limiting + captcha wrap this in Stage 3.7.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  createToken,
  expiryFromNow,
  EMAIL_VERIFICATION_TTL_HOURS,
} from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { signUpSchema } from "@/lib/validation/user";
import { User } from "@/models/user";

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Check the form and try again.",
      },
      { status: 422 },
    );
  }
  const { name, email, password } = parsed.data;

  await dbConnect();

  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    return NextResponse.json(
      { error: "That email's already in use. Try signing in." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const { token, tokenHash } = createToken();

  await User.create({
    name,
    email,
    passwordHash,
    role: "member",
    status: "active",
    provider: "credentials",
    emailVerified: null,
    emailVerificationToken: tokenHash,
    emailVerificationExpires: expiryFromNow(EMAIL_VERIFICATION_TTL_HOURS),
  });

  try {
    await sendVerificationEmail(email, token);
  } catch (err) {
    // The account exists; surface a soft failure so the user can request a
    // resend rather than getting stuck. (Email infra issues shouldn't 500.)
    // eslint-disable-next-line no-console
    console.error("Verification email failed:", err);
  }

  return NextResponse.json({ ok: true, email }, { status: 201 });
}
