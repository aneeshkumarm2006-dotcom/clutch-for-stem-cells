/**
 * Review submission `/api/reviews` (PRD §6.4).
 *
 * Public, unauthenticated. A clean review is created as `pending` so it lands in
 * the admin moderation queue — an admin approves or rejects it before it goes
 * live; it never auto-publishes. The spam guard (`lib/spam/guard`) owns rate
 * limiting, duplicate detection, the captcha, and classification:
 *
 *   allow      → `status: "pending"`, normal moderation queue.
 *   quarantine → `status: "spam"`, out of the queue and out of the unread count,
 *                reviewable (and restorable) in `/admin/reviews?view=spam`.
 *   reject     → never written to `Review`; binned in `BlockedSubmission` and
 *                answered with the normal success response.
 *
 * The reviewer email is collected and stored privately (PRD §14) but isn't used
 * for anything automated.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { guardSubmission, spamSuccessResponse } from "@/lib/spam/guard";
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

  const raw = (body ?? {}) as Record<string, unknown>;

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

  // The review body is split across six labelled prompts; the classifier scores
  // them as one document so a pitch can't hide by being spread across fields.
  const bodyText = [
    data.body.condition,
    data.body.whyChosen,
    data.body.treatmentDescription,
    data.body.outcome,
    data.body.experience,
    data.body.improvement,
  ].filter((s): s is string => Boolean(s));

  const guard = await guardSubmission(req, {
    form: "review",
    captchaToken: typeof raw.captchaToken === "string" ? raw.captchaToken : null,
    payload: raw,
    input: {
      name: data.reviewer.displayName,
      email: data.reviewer.email,
      subject: data.headline,
      message: bodyText.join("\n\n"),
      extra: [data.reviewer.country, ...data.whyChosenTags],
      honeypot: typeof raw.hp === "string" ? raw.hp : undefined,
      elapsedMs: typeof raw.elapsedMs === "number" ? raw.elapsedMs : undefined,
    },
  });

  if (guard.blocked) return guard.blocked;
  if (guard.rejected) return spamSuccessResponse({ ok: true }, 201);

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
    status: guard.assessment.verdict === "quarantine" ? "spam" : "pending",
    spam: guard.spamMeta,
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
