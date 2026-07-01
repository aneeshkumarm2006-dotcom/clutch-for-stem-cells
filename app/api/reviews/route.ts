/**
 * Review submission `/api/reviews` (PRD §6.4).
 *
 * Public, unauthenticated. Creates the review as `pending` so it lands directly
 * in the admin moderation queue — an admin approves or rejects it before it goes
 * live; it never auto-publishes. Rate-limited + captcha-guarded. The reviewer
 * email is collected and stored privately (PRD §14) but isn't used for anything
 * automated.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { guardPublicForm } from "@/lib/public-form";
import { trackEvent } from "@/lib/analytics";
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
  });

  // Analytics — submission, by clinic (no PII). Approval rate is derived later
  // from review status in admin. PRD §15.
  void trackEvent("review_submit", { clinicId: String(data.clinicId) });

  return NextResponse.json({ ok: true }, { status: 201 });
}
