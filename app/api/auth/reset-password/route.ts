/**
 * Complete a password reset — Stage 2.2.
 *
 * Validates the token (hash + expiry), sets the new password, and clears the
 * token. Proving control of the email also verifies it, so we set
 * `emailVerified` if it wasn't already. The reset token is single-use.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { passwordResetSchema } from "@/lib/validation/user";
import { User } from "@/models/user";

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = passwordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Check the form and try again.",
      },
      { status: 422 },
    );
  }
  const { token, password } = parsed.data;

  await dbConnect();
  const user = await User.findOne({
    passwordResetToken: hashToken(token),
  }).select("+passwordResetToken +passwordResetExpires emailVerified");

  if (
    !user ||
    !user.passwordResetExpires ||
    user.passwordResetExpires.getTime() < Date.now()
  ) {
    return NextResponse.json(
      {
        error: "That reset link is invalid or has expired. Request a new one.",
      },
      { status: 400 },
    );
  }

  user.passwordHash = await hashPassword(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  if (!user.emailVerified) user.emailVerified = new Date();
  await user.save();

  return NextResponse.json({ ok: true });
}
