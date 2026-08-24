/**
 * Guide capture `/api/email-capture`.
 *
 * Public, unauthenticated. Receives the one email address the guide-capture
 * modal collects, stores it with everything the browser knew at the time (which
 * trigger fired, the shortlist, the page, the campaign), and then sends the one
 * email the modal promised: the visitor's shortlist plus the 12 questions.
 *
 * Two emails go out, in this order: the guide to the subscriber, then a
 * notification to the owners (`LEADS_NOTIFY_EMAIL`, same recipients as a lead)
 * reporting the signup *and* whether the guide actually left.
 *
 * Order matters. The capture is persisted *first* and both sends are *awaited*
 * after it, exactly as `/api/leads` does it: a serverless instance freezes the
 * moment the response returns, so a fire-and-forget SMTP handshake dies
 * mid-flight, and a mail outage must never cost a captured address. A failed
 * guide send lands as `delivery: "failed"` with the error on the record, one
 * click from a resend in `/admin/captures`; a failed notification leaves
 * `ownerNotifiedAt` null, which the queue surfaces.
 *
 * Abuse handling is lighter than the lead/review forms on purpose. There is no
 * classifier verdict to make here: the payload is a single address, the only
 * thing a bot can achieve is mailing that address our own guide, and the reply
 * is identical either way. So it is rate limit, captcha, honeypot, and a
 * submit-speed floor, and the response is always a success shape.
 */
import { NextResponse } from "next/server";

import { GUIDE_QUESTIONS } from "@/config/guide-capture";
import { trackEvent } from "@/lib/analytics";
import { dbConnect } from "@/lib/db";
import {
  sendCaptureNotificationEmail,
  sendShortlistGuideEmail,
} from "@/lib/email";
import { guardPublicForm } from "@/lib/public-form";
import { absoluteUrl } from "@/lib/seo";
import {
  CAPTURE_DELIVERY_LABELS,
  CAPTURE_TRIGGER_LABELS,
} from "@/lib/enums";
import { emailCaptureCreateSchema } from "@/lib/validation/email-capture";
import { Clinic, EmailCapture } from "@/models";
import type { IClinic } from "@/models";

export const dynamic = "force-dynamic";
// Live SMTP work after the write — Node runtime (Edge has no TCP sockets) with
// headroom over the default function timeout for a slow handshake.
export const runtime = "nodejs";
export const maxDuration = 30;

/** Below this, the form was filled faster than a human can read it. */
const MIN_ELAPSED_MS = 1200;

/** Answered for every outcome, so a bot learns nothing from being refused. */
function accepted(): Response {
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;

  // Rate limit + captcha. Both fail closed with their own response; the captcha
  // is a no-op until `CAPTCHA_SECRET_KEY` is configured (see `lib/captcha`).
  const blocked = await guardPublicForm(req, {
    action: "email-capture",
    captchaToken:
      typeof raw.captchaToken === "string" ? raw.captchaToken : null,
    limit: 8,
    windowSeconds: 600,
  });
  if (blocked) return blocked;

  // Honeypot and submit-speed floor. Both are silent: the caller sees the same
  // 201 a real visitor gets, and nothing is written.
  if (typeof raw.hp === "string" && raw.hp.trim() !== "") return accepted();
  if (typeof raw.elapsedMs === "number" && raw.elapsedMs < MIN_ELAPSED_MS) {
    return accepted();
  }

  const parsed = emailCaptureCreateSchema.safeParse(body);
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

  // Resolve the saved slugs to live clinics. Only published, non-deleted ones
  // are emailed; the raw slug list is stored either way so an operator can see
  // what the visitor actually had saved.
  const clinics = data.shortlistSlugs.length
    ? await Clinic.find({
        slug: { $in: data.shortlistSlugs },
        status: "published",
        isDeleted: false,
      })
        .select("name slug tagline locations")
        .lean<IClinic[]>()
    : [];

  // Preserve the visitor's own ordering rather than Mongo's.
  const order = new Map(data.shortlistSlugs.map((s, i) => [s, i]));
  clinics.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));

  const capture = await EmailCapture.create({
    email: data.email,
    trigger: data.trigger,
    shortlistSlugs: data.shortlistSlugs,
    clinicIds: clinics.map((c) => c._id),
    shortlistCount: data.shortlistSlugs.length,
    profileViewCount: data.profileViewCount,
    path: data.path,
    referrer: data.referrer,
    utm: data.utm,
    status: "new",
    delivery: "pending",
  });

  // Funnel counter. Server-side and PII-free: the trigger and the shortlist
  // size travel, the address never does (PRD §13/§15).
  void trackEvent("guide_capture", {
    trigger: data.trigger,
    shortlistCount: data.shortlistSlugs.length,
  });

  const result = await sendShortlistGuideEmail({
    to: data.email,
    clinics: clinics.map((c) => {
      const primary = c.locations?.[0];
      return {
        name: c.name,
        slug: c.slug,
        location: [primary?.city, primary?.country].filter(Boolean).join(", "),
        focus: c.tagline,
      };
    }),
    questions: GUIDE_QUESTIONS,
  });

  capture.delivery = result.ok ? "sent" : result.skipped ? "skipped" : "failed";
  capture.sentAt = result.ok ? new Date() : null;
  capture.deliveryError = result.ok
    ? undefined
    : (result.error ?? result.skipped);

  // Owner notification. Wrapped because the label lookups and the send are the
  // only things left that could throw, and by this point the address is already
  // safely stored: nothing here is allowed to cost us the capture.
  try {
    const notified = await sendCaptureNotificationEmail({
      manageUrl: absoluteUrl("/admin/captures"),
      capture: {
        email: data.email,
        triggerLabel: CAPTURE_TRIGGER_LABELS[data.trigger],
        clinicNames: clinics.map((c) => c.name),
        unresolvedSlugs: data.shortlistSlugs.filter(
          (slug) => !clinics.some((c) => c.slug === slug),
        ),
        profileViewCount: data.profileViewCount,
        path: data.path,
        referrer: data.referrer,
        utm: data.utm,
        deliveryLabel: CAPTURE_DELIVERY_LABELS[capture.delivery],
        deliveryError: capture.deliveryError,
      },
    });
    if (notified.ok) capture.ownerNotifiedAt = new Date();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Guide signup notification failed:", err);
  }

  await capture.save();

  return accepted();
}
