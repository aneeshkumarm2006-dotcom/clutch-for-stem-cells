/**
 * Lead intake `/api/leads` (Stage 5.6 / 5.12 / 5.13 — PRD §6.5, §6.8, §7).
 *
 * Public, unauthenticated. Handles consultation/quote/message/match leads from
 * the clinic profile dialog, the find-a-clinic wizard, and the contact form.
 * Validated with `leadCreateSchema`, then scored by the spam guard
 * (`lib/spam/guard`), which owns rate limiting, duplicate detection, the
 * captcha, and classification.
 *
 * Three outcomes:
 *
 *   allow      → saved with `status: "new"`, owners notified.
 *   quarantine → saved with `status: "spam"` and the classifier's reasons, and
 *                **not** emailed. It shows up in `/admin/leads?view=spam`, one
 *                click from being restored.
 *   reject     → never written to `Lead`; copied to `BlockedSubmission` (30-day
 *                TTL, visible at `/admin/spam`) and answered with the normal
 *                success response so the bot neither retries nor adapts.
 *
 * The lead is persisted *before* the notification, and the notification is
 * awaited — a mail failure can never cost a saved lead.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { guardSubmission, spamSuccessResponse } from "@/lib/spam/guard";
import { trackEvent } from "@/lib/analytics";
import { sendLeadNotificationEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/seo";
import { BUDGET_LABELS } from "@/config/lead-options";
import { leadCreateSchema } from "@/lib/validation/lead";
import { Clinic, Condition, Lead, Treatment } from "@/models";

export const dynamic = "force-dynamic";
// The owner notification does live SMTP work after the lead is saved — Node
// runtime (Edge has no TCP sockets) with headroom over Vercel's default
// function timeout so a slow SMTP handshake can't cut the request short.
export const runtime = "nodejs";
export const maxDuration = 30;

const TYPE_LABELS: Record<string, string> = {
  consultation: "Consultation request",
  quote: "Quote request",
  message: "Contact enquiry",
  match: "Clinic match request",
};

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;

  const parsed = leadCreateSchema.safeParse(body);
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

  const guard = await guardSubmission(req, {
    form: "lead",
    captchaToken: typeof raw.captchaToken === "string" ? raw.captchaToken : null,
    payload: raw,
    input: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      message: data.message,
      extra: [data.country, data.budgetRange],
      constrained: [
        {
          field: "budgetRange",
          value: data.budgetRange,
          allowed: BUDGET_LABELS,
        },
      ],
      honeypot: typeof raw.hp === "string" ? raw.hp : undefined,
      elapsedMs: typeof raw.elapsedMs === "number" ? raw.elapsedMs : undefined,
    },
  });

  if (guard.blocked) return guard.blocked;

  // Rejected: binned, never stored as a lead, answered like a success.
  if (guard.rejected) return spamSuccessResponse({ ok: true }, 201);

  await dbConnect();

  const quarantined = guard.assessment.verdict === "quarantine";

  const lead = await Lead.create({
    type: data.type,
    clinicId: data.clinicId ?? null,
    matchedClinicIds: data.matchedClinicIds,
    name: data.name,
    email: data.email,
    phone: data.phone,
    country: data.country,
    conditionId: data.conditionId,
    treatmentInterest: data.treatmentInterest,
    budgetRange: data.budgetRange,
    timeframe: data.timeframe,
    message: data.message,
    consentGiven: data.consentGiven,
    ageConfirmed: data.ageConfirmed,
    source: data.source,
    status: quarantined ? "spam" : "new",
    spam: guard.spamMeta,
  });

  // Analytics (no PII — type + source + clinic only). PRD §15.
  void trackEvent("lead_submit", {
    clinicId: data.clinicId ? String(data.clinicId) : undefined,
    leadType: data.type,
    source: data.source,
  });

  // Owner notification — persisted above, notified second, and *awaited*: on a
  // serverless host the instance freezes once the response returns, which would
  // kill a fire-and-forget SMTP handshake mid-flight. The send itself never
  // throws; this try/catch covers the label lookups, so a mail or lookup
  // failure can never cost the saved lead.
  //
  // Quarantined leads are stored but never emailed — that is the whole point of
  // the middle verdict. They're reviewed in `/admin/leads?view=spam`.
  if (guard.notify) {
    try {
      const [clinic, matchedClinics, condition, treatments] = await Promise.all([
        data.clinicId
          ? Clinic.findById(data.clinicId).select("name").lean()
          : null,
        data.matchedClinicIds.length
          ? Clinic.find({ _id: { $in: data.matchedClinicIds } })
              .select("name")
              .lean()
          : [],
        data.conditionId
          ? Condition.findById(data.conditionId).select("name").lean()
          : null,
        data.treatmentInterest.length
          ? Treatment.find({ _id: { $in: data.treatmentInterest } })
              .select("name")
              .lean()
          : [],
      ]);

      await sendLeadNotificationEmail({
        manageUrl: absoluteUrl("/admin/leads"),
        lead: {
          typeLabel: TYPE_LABELS[data.type] ?? "Inquiry",
          name: data.name,
          email: data.email,
          phone: data.phone,
          country: data.country,
          conditionLabel: condition?.name,
          treatmentLabels: treatments.map((t) => t.name),
          budgetRange: data.budgetRange,
          timeframe: data.timeframe,
          message: data.message,
          clinicName: clinic?.name,
          matchedClinicNames: matchedClinics.map((c) => c.name),
          consentGiven: data.consentGiven,
          ageConfirmed: data.ageConfirmed,
          source: data.source,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Lead notification failed:", err);
    }
  }

  return NextResponse.json({ ok: true, id: String(lead._id) }, { status: 201 });
}
