/**
 * Lead intake `/api/leads` (Stage 5.6 / 5.12 / 5.13 — PRD §6.5, §6.8, §7).
 *
 * Public, unauthenticated. Handles consultation/quote/message/match leads from
 * the clinic profile dialog, the find-a-clinic wizard, and the contact form.
 * Rate-limited + captcha-guarded (captcha is bypassed in dev — see lib/captcha),
 * validated with `leadCreateSchema`, then a notification email is sent to the
 * clinic and/or admin. Reviewer/contact PII lives only in the lead + that email.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { guardPublicForm } from "@/lib/public-form";
import { trackEvent } from "@/lib/analytics";
import { sendLeadNotificationEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/seo";
import { leadCreateSchema } from "@/lib/validation/lead";
import { Clinic, Condition, Lead, SiteSetting, Treatment } from "@/models";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  consultation: "Consultation request",
  quote: "Quote request",
  message: "Message",
  match: "Clinic match",
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

  // Best-effort notification — never block the response on email.
  try {
    const settings = await SiteSetting.getGlobal();
    const adminEmail = settings.contact?.email || process.env.EMAIL_FROM;

    const [clinic, condition, treatments] = await Promise.all([
      data.clinicId
        ? Clinic.findById(data.clinicId).select("name contactEmail").lean()
        : null,
      data.conditionId
        ? Condition.findById(data.conditionId).select("name").lean()
        : null,
      data.treatmentInterest.length
        ? Treatment.find({ _id: { $in: data.treatmentInterest } })
            .select("name")
            .lean()
        : [],
    ]);

    const recipients = new Set<string>();
    if (clinic?.contactEmail) recipients.add(clinic.contactEmail);
    if (adminEmail) recipients.add(adminEmail);

    const manageUrl = absoluteUrl(`/admin/leads/${lead._id}`);
    await Promise.all(
      [...recipients].map((to) =>
        sendLeadNotificationEmail({
          to,
          manageUrl,
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
          },
        }),
      ),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Lead notification failed:", err);
  }

  return NextResponse.json({ ok: true, id: String(lead._id) }, { status: 201 });
}
