/**
 * Lead intake `/api/leads` (Stage 5.6 / 5.12 / 5.13 — PRD §6.5, §6.8, §7).
 *
 * Public, unauthenticated. Handles consultation/quote/message/match leads from
 * the clinic profile dialog, the find-a-clinic wizard, and the contact form.
 * Rate-limited + captcha-guarded (captcha is bypassed in dev — see lib/captcha),
 * validated with `leadCreateSchema`. The lead is persisted first, then the site
 * owners are notified by email (`LEADS_NOTIFY_EMAIL` — never the clinic, never
 * the submitter). Contact PII lives only in the lead + that internal email.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { guardPublicForm } from "@/lib/public-form";
import { trackEvent } from "@/lib/analytics";
import { sendLeadNotificationEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/seo";
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

  const captchaToken =
    body && typeof body === "object"
      ? ((body as Record<string, unknown>).captchaToken as string | undefined)
      : undefined;

  const blocked = await guardPublicForm(req, {
    action: "lead",
    captchaToken,
  });
  if (blocked) return blocked;

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

  await dbConnect();

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
    status: "new",
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
  try {
    const [clinic, matchedClinics, condition, treatments] = await Promise.all([
      data.clinicId ? Clinic.findById(data.clinicId).select("name").lean() : null,
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

  return NextResponse.json({ ok: true, id: String(lead._id) }, { status: 201 });
}
