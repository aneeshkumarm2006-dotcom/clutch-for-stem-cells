/**
 * Review submission `/api/reviews` (Stage 5.5 / PRD §6.4).
 *
 * Public, unauthenticated. Creates the review as `pending` **and**
 * email-unverified, then emails a confirmation link. The review only enters the
 * moderation queue once the reviewer opens that link (anti-spam — PRD §6.4); it
 * never auto-publishes. Rate-limited + captcha-guarded; the reviewer email is
 * stored privately (PRD §14) and used only for verification/status.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { createToken, expiryFromNow, EMAIL_VERIFICATION_TTL_HOURS } from "@/lib/auth/tokens";
import { guardPublicForm } from "@/lib/public-form";
import { sendReviewConfirmationEmail } from "@/lib/email";
import { reviewSubmitSchema } from "@/lib/validation/review";
import { Clinic, Review } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const captchaToken =
    body && typeof body === "object"
      ? ((body as Record<string, unknown>).captchaToken as string | undefined)
      : undefined;

  const blocked = await guardPublicForm(req, {
    action: "review",
    captchaToken,
  });
  if (blocked) return blocked;

  const parsed = reviewSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Check the form and try again.",
      },
      { status: 422 },
    );
  }
  const data = parsed.data;

  await dbConnect();

  const clinic = await Clinic.findOne({
    _id: data.clinicId,
    status: "published",
    isDeleted: false,
  })
    .select("name slug")
    .lean();
  if (!clinic) {
    return NextResponse.json(
      { error: "We couldn't find that clinic." },
      { status: 404 },
    );
  }

  const { token, tokenHash } = createToken();

  await Review.create({
    clinicId: data.clinicId,
    status: "pending",
    isVerified: false,
    reviewer: {
      displayName: data.reviewer.displayName,
      isAnonymous: data.reviewer.isAnonymous,
      email: data.reviewer.email,
      country: data.reviewer.country,
      ageRange: data.reviewer.ageRange,
    },
    conditionId: data.conditionId,
    treatmentId: data.treatmentId,
    treatmentDate: data.treatmentDate,
    cost: data.cost,
    ratingOverall: data.ratingOverall,
    ratings: data.ratings,
    headline: data.headline,
    body: data.body,
    whyChosenTags: data.whyChosenTags,
    wouldRecommend: data.wouldRecommend,
    consentGiven: data.consentGiven,
    ageConfirmed: data.ageConfirmed,
    emailVerifiedAt: null,
    emailVerificationToken: tokenHash,
    emailVerificationExpires: expiryFromNow(EMAIL_VERIFICATION_TTL_HOURS),
  });

  try {
    await sendReviewConfirmationEmail({
      to: data.reviewer.email,
      token,
      clinicName: clinic.name,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Review confirmation email failed:", err);
  }

  return NextResponse.json(
    { ok: true, email: data.reviewer.email },
    { status: 201 },
  );
}
