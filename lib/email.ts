/**
 * Transactional + notification email — sent from our own mailbox over SMTP
 * (nodemailer). No third-party sending service.
 *
 * `sendEmail` is the low-level sender; the `send*` helpers below build the
 * auth templates (verification + password reset), the owner lead notification,
 * and the review-status templates. Config comes from env (`SMTP_*`,
 * `EMAIL_FROM`, `LEADS_NOTIFY_EMAIL`); with credentials unset (local dev),
 * emails are logged to the server console instead of sent, so every flow is
 * fully testable without a mailbox.
 *
 * Nothing in this module throws. Senders resolve to a {@link SendResult} and
 * log failures to the server console, so an email outage can never fail the
 * request that triggered it — callers persist first, then `await` the send
 * (never fire-and-forget: a serverless instance is frozen the moment the
 * response returns, which kills an un-awaited SMTP handshake mid-flight).
 * `/api/admin/email-test` surfaces `verifyTransport()` + which env vars landed.
 */
import nodemailer, { type Transporter } from "nodemailer";

import { SITE_NAME, SITE_URL } from "@/config/site";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
// Gmail silently rewrites the From header unless it matches the authenticated
// account (or a verified "send mail as" alias) — keep EMAIL_FROM on it.
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

/** Cached at module level so a warm serverless instance reuses it. */
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 = implicit TLS; 587 upgrades via STARTTLS
    requireTLS: SMTP_PORT !== 465, // never let STARTTLS fall back to plaintext
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Bounded timeouts: blocked egress fails fast instead of hanging the
    // request until the serverless function itself times out.
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export interface SendResult {
  /** True when the SMTP server accepted the message. */
  ok: boolean;
  /** Set when sending was skipped cleanly (no credentials / no recipients). */
  skipped?: string;
  /** Set when the SMTP attempt itself failed. */
  error?: string;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text fallback (also what's logged in dev). */
  text: string;
  /** Reply-To — e.g. the submitter's address on owner notifications. */
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailInput): Promise<SendResult> {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) {
    return { ok: false, skipped: "No recipients configured." };
  }

  const transport = getTransporter();
  if (!transport) {
    // Dev fallback — no SMTP credentials. Surface the content (incl. links).
    // eslint-disable-next-line no-console
    console.info(
      `\n📧 [email:dev] (SMTP_USER/SMTP_PASS unset — not sent)\n  To: ${recipients.join(", ")}\n  Subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}\n`,
    );
    return { ok: false, skipped: "SMTP credentials not configured." };
  }

  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      to: recipients,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Email send failed ("${subject}"):`, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Open the SMTP connection and authenticate **without sending anything** —
 * the connect-and-auth half of a send. Used by `/api/admin/email-test` and
 * `scripts/verify-smtp.ts` to make a misconfigured deploy visible.
 */
export async function verifyTransport(): Promise<SendResult> {
  const transport = getTransporter();
  if (!transport) {
    return { ok: false, skipped: "SMTP credentials not configured." };
  }
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("SMTP verify failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Owner-notification recipients: `LEADS_NOTIFY_EMAIL` as a comma-separated
 * list (trimmed, blanks dropped, deduped). Falls back to the admin-configured
 * Settings → contact email — read only when the env var is empty, so the
 * common path stays out of the database.
 */
export async function resolveLeadRecipients(): Promise<string[]> {
  const seen = new Set<string>();
  const fromEnv: string[] = [];
  for (const part of (process.env.LEADS_NOTIFY_EMAIL ?? "").split(",")) {
    const value = part.trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    fromEnv.push(value);
  }
  if (fromEnv.length > 0) return fromEnv;

  try {
    // Dynamic imports keep mongoose out of contexts that never hit the
    // fallback (e.g. `scripts/verify-smtp.ts` runs without a database).
    const [{ dbConnect }, { SiteSetting }] = await Promise.all([
      import("@/lib/db"),
      import("@/models/site-setting"),
    ]);
    await dbConnect();
    const settings = await SiteSetting.getGlobal();
    const contact = settings.contact?.email?.trim();
    if (contact) return [contact];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Lead recipient fallback (Settings contact) failed:", err);
  }
  return [];
}

// ── Shared layout ────────────────────────────────────────────────────────────

/** Minimal on-brand HTML shell (Azure Clinical tokens, inline styles for email). */
function layout(
  heading: string,
  bodyHtml: string,
  footerNote = `${SITE_NAME} is an informational directory, not a medical provider. This email was sent for account security.`,
): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#F2F8FD;font-family:Inter,Arial,sans-serif;color:#0C2233;line-height:1.6;">
    <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
      <div style="font-weight:700;font-size:18px;color:#0E80CC;margin-bottom:24px;">${SITE_NAME}</div>
      <div style="background:#fff;border:1px solid #D8E8F4;border-radius:16px;padding:28px;">
        <h1 style="font-size:20px;margin:0 0 12px;">${heading}</h1>
        ${bodyHtml}
      </div>
      <p style="color:#90AAC0;font-size:12px;margin-top:20px;">
        ${footerNote}
      </p>
    </div>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#0E80CC;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 20px;border-radius:10px;">${label}</a>`;
}

/** Escape interpolated user content so emails can't be HTML-injected. */
function esc(value?: string | number | null): string {
  if (value == null) return "";
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

/** Render a label/value definition list, skipping empty values. */
function detailRows(rows: [string, string | undefined | null][]): string {
  return rows
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 0;color:#90AAC0;font-size:13px;vertical-align:top;width:140px;">${esc(label)}</td>
          <td style="padding:6px 0;color:#0C2233;font-size:14px;">${esc(value)}</td>
        </tr>`,
    )
    .join("");
}

// ── Auth templates ───────────────────────────────────────────────────────────

export function resetPasswordUrl(token: string): string {
  return `${SITE_URL}/auth/reset?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<SendResult> {
  const url = resetPasswordUrl(token);
  return sendEmail({
    to,
    subject: `Reset your ${SITE_NAME} password`,
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 20px;color:#5C7388;">Choose a new password for your account.</p>
       ${button(url, "Reset password")}
       <p style="margin:20px 0 0;color:#90AAC0;font-size:13px;">This link expires in 1 hour. If you didn't request a reset, you can ignore this email and your password won't change.</p>`,
    ),
    text: `Reset your ${SITE_NAME} password by opening this link (expires in 1 hour):\n${url}\n\nIf you didn't request a reset, you can ignore this email.`,
  });
}

// ── Owner lead notification (Stage 3.5 / PRD §6.5, §8.4) ─────────────────────

/** Human-readable lead fields (caller resolves taxonomy refs to labels first). */
export interface LeadEmailData {
  /** Lead type label, e.g. "Consultation request" or "Clinic match request". */
  typeLabel: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  conditionLabel?: string;
  treatmentLabels?: string[];
  budgetRange?: string;
  timeframe?: string;
  message?: string;
  /** Set for clinic-directed leads; omit for matching-wizard leads. */
  clinicName?: string;
  /** Wizard results the visitor was shown (match leads). */
  matchedClinicNames?: string[];
  consentGiven?: boolean;
  ageConfirmed?: boolean;
  /** Where on the site the form was submitted, e.g. "clinic-profile". */
  source?: string;
}

/**
 * Notify the site owners of a new lead: one message to every configured
 * recipient ({@link resolveLeadRecipients}), Reply-To set to the submitter so
 * hitting reply starts a direct thread. The submitter never gets an auto-reply.
 * The body carries every captured field (`leadCreateSchema`); PII stays in the
 * lead record + this internal email, never anywhere public. `manageUrl`
 * deep-links to the admin leads queue.
 */
export async function sendLeadNotificationEmail({
  lead,
  manageUrl,
}: {
  lead: LeadEmailData;
  manageUrl?: string;
}): Promise<SendResult> {
  const to = await resolveLeadRecipients();

  const subject = lead.clinicName
    ? `New ${lead.typeLabel.toLowerCase()}: ${lead.clinicName} | ${SITE_NAME}`
    : `New ${lead.typeLabel.toLowerCase()} from ${lead.name} | ${SITE_NAME}`;

  const yesNo = (v?: boolean): string | undefined =>
    v == null ? undefined : v ? "Yes" : "No";

  const fields: [string, string | undefined | null][] = [
    ["Type", lead.typeLabel],
    ["Clinic", lead.clinicName],
    ["Matched clinics", lead.matchedClinicNames?.join(", ")],
    ["Name", lead.name],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Country", lead.country],
    ["Condition", lead.conditionLabel],
    ["Treatments", lead.treatmentLabels?.join(", ")],
    ["Budget", lead.budgetRange],
    ["Timeframe", lead.timeframe],
    ["Consent given", yesNo(lead.consentGiven)],
    ["Age confirmed", yesNo(lead.ageConfirmed)],
    ["Source", lead.source],
  ];

  const message = lead.message
    ? `<p style="margin:18px 0 0;color:#5C7388;font-size:13px;">Message</p>
       <p style="margin:4px 0 0;color:#0C2233;white-space:pre-wrap;">${esc(lead.message)}</p>`
    : "";

  const textLines = fields
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([label, value]) => `${label}: ${value}`);
  if (lead.message) textLines.push(`\nMessage:\n${lead.message}`);
  if (manageUrl) textLines.push(`\nManage: ${manageUrl}`);

  return sendEmail({
    to,
    replyTo: lead.email,
    subject,
    html: layout(
      "New inquiry received",
      `<p style="margin:0 0 16px;color:#5C7388;">A new lead just came in through ${SITE_NAME}.</p>
       <table style="width:100%;border-collapse:collapse;">${detailRows(fields)}</table>
       ${message}
       ${manageUrl ? `<p style="margin:24px 0 0;">${button(manageUrl, "Open in admin")}</p>` : ""}`,
      `Internal notification for the ${SITE_NAME} owners. Replying goes to the submitter.`,
    ),
    text: `New inquiry via ${SITE_NAME}\n\n` + textLines.join("\n"),
  });
}

// ── Review status (Stage 3.5 / PRD §6.4, §8.3) ───────────────────────────────

export type ReviewStatusOutcome = "approved" | "rejected";

/**
 * Tell a reviewer the outcome of moderation. Approved → link to the now-live
 * review on the clinic profile; rejected → optional reason. Sent to the
 * reviewer's private email (never exposed elsewhere — PRD §14).
 */
export async function sendReviewStatusEmail({
  to,
  outcome,
  clinicName,
  clinicSlug,
  rejectionReason,
}: {
  to: string;
  outcome: ReviewStatusOutcome;
  clinicName: string;
  clinicSlug?: string;
  rejectionReason?: string;
}): Promise<SendResult> {
  if (outcome === "approved") {
    const url = clinicSlug ? `${SITE_URL}/clinic/${clinicSlug}` : SITE_URL;
    return sendEmail({
      to,
      subject: `Your review of ${clinicName} is live`,
      html: layout(
        "Your review is published",
        `<p style="margin:0 0 20px;color:#5C7388;">Thanks for sharing your experience with ${esc(clinicName)}. Your review has been approved and is now live.</p>
         ${button(url, "View your review")}
         <p style="margin:20px 0 0;color:#90AAC0;font-size:13px;">Reviews are informational and reflect individual experiences; results vary.</p>`,
        `${SITE_NAME} is an informational directory, not a medical provider.`,
      ),
      text: `Thanks for sharing your experience with ${clinicName}. Your review is now live:\n${url}\n\nReviews are informational and reflect individual experiences; results vary.`,
    });
  }

  const reason = rejectionReason
    ? `<p style="margin:16px 0 0;color:#5C7388;font-size:13px;">Reason</p>
       <p style="margin:4px 0 0;color:#0C2233;">${esc(rejectionReason)}</p>`
    : "";
  return sendEmail({
    to,
    subject: `About your review of ${clinicName}`,
    html: layout(
      "We couldn't publish your review",
      `<p style="margin:0 0 4px;color:#5C7388;">Thanks for taking the time to review ${esc(clinicName)}. After moderation, we weren't able to publish it.</p>
       ${reason}
       <p style="margin:20px 0 0;color:#90AAC0;font-size:13px;">If you think this was a mistake, reply to this email and our team will take another look.</p>`,
      `${SITE_NAME} is an informational directory, not a medical provider.`,
    ),
    text:
      `Thanks for reviewing ${clinicName}. After moderation, we weren't able to publish your review.` +
      (rejectionReason ? `\n\nReason: ${rejectionReason}` : "") +
      `\n\nIf you think this was a mistake, reply to this email and our team will take another look.`,
  });
}

// ── Guide capture: shortlist + the 12 questions ──────────────────────────────

/** One saved clinic, resolved to display fields by the caller. */
export interface GuideClinicSummary {
  name: string;
  slug: string;
  location?: string;
  focus?: string;
}

/**
 * Deliver what the capture modal promised: the visitor's shortlist and the 12
 * questions to ask any clinic. This is the entire relationship. There is no
 * sequence behind it, which is why the modal can honestly say "sent once", so
 * the message has to stand on its own.
 *
 * Sent to the address the visitor typed, so `to` is submitter-controlled: every
 * interpolated value goes through `esc`, and the clinic links are built from
 * our own slugs rather than anything in the request body.
 */
export async function sendShortlistGuideEmail({
  to,
  clinics,
  questions,
}: {
  to: string;
  clinics: GuideClinicSummary[];
  questions: readonly { question: string; why: string }[];
}): Promise<SendResult> {
  const shortlistUrl = `${SITE_URL}/shortlist`;

  const clinicsHtml = clinics.length
    ? `<h2 style="font-size:15px;margin:24px 0 10px;">Your shortlist</h2>
       ${clinics
         .map(
           (c) => `<div style="border:1px solid #D8E8F4;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
             <a href="${SITE_URL}/clinic/${encodeURIComponent(c.slug)}" style="color:#0E80CC;font-weight:600;font-size:15px;text-decoration:none;">${esc(c.name)}</a>
             ${c.location ? `<div style="color:#5C7388;font-size:13px;margin-top:2px;">${esc(c.location)}</div>` : ""}
             ${c.focus ? `<div style="color:#90AAC0;font-size:12.5px;margin-top:2px;">${esc(c.focus)}</div>` : ""}
           </div>`,
         )
         .join("")}
       <p style="margin:12px 0 0;font-size:13px;color:#5C7388;">Your live shortlist stays at <a href="${shortlistUrl}" style="color:#0E80CC;">${shortlistUrl}</a> in the browser you saved it from.</p>`
    : `<h2 style="font-size:15px;margin:24px 0 10px;">Your shortlist</h2>
       <p style="margin:0;color:#5C7388;font-size:14px;">You had not saved a clinic yet. Save one from any profile and it appears at <a href="${shortlistUrl}" style="color:#0E80CC;">${shortlistUrl}</a>.</p>`;

  const questionsHtml = questions
    .map(
      (q, i) => `<div style="margin:0 0 16px;">
        <div style="font-size:14px;font-weight:600;color:#0C2233;">${i + 1}. ${esc(q.question)}</div>
        <div style="font-size:13px;color:#5C7388;margin-top:3px;">${esc(q.why)}</div>
      </div>`,
    )
    .join("");

  const textLines = [
    `Your shortlist and the 12 questions to ask any stem cell clinic.`,
    "",
    "YOUR SHORTLIST",
    ...(clinics.length
      ? clinics.map(
          (c) =>
            `- ${c.name}${c.location ? ` (${c.location})` : ""}\n  ${SITE_URL}/clinic/${c.slug}`,
        )
      : [`- Nothing saved yet. Save a clinic and it appears at ${shortlistUrl}.`]),
    "",
    "THE 12 QUESTIONS",
    ...questions.flatMap((q, i) => [`${i + 1}. ${q.question}`, `   Why: ${q.why}`]),
    "",
    `${SITE_NAME} is an informational directory, not a medical provider. This is information only, not medical advice. Always consult a licensed physician.`,
    "",
    "You received this because you asked for it on our site. We do not add you to any list, and this is the only email we send.",
  ];

  return sendEmail({
    to,
    subject: `Your shortlist and the 12 questions to ask any clinic | ${SITE_NAME}`,
    html: layout(
      "Your shortlist and the 12 questions",
      `<p style="margin:0 0 4px;color:#5C7388;">Here is everything you asked for. Take the questions to the consultation and write the answers down, so you can compare clinics side by side later.</p>
       ${clinicsHtml}
       <h2 style="font-size:15px;margin:26px 0 12px;">The 12 questions to ask any stem cell clinic</h2>
       ${questionsHtml}
       <p style="margin:22px 0 0;">${button(shortlistUrl, "Open your shortlist")}</p>
       <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #D8E8F4;color:#90AAC0;font-size:12.5px;">Information only. Not medical advice or an endorsement. Always consult a licensed physician. Individual results vary and no outcome is guaranteed.</p>`,
      `${SITE_NAME} is an informational directory, not a medical provider. You received this because you requested it on our site, and this is the only email we send. Reply to this message to be removed from our records.`,
    ),
    text: textLines.join("\n"),
  });
}

/** What the owners are told about a new guide signup. */
export interface CaptureNotificationData {
  email: string;
  /** Human label for the trigger, e.g. "Saved to shortlist". */
  triggerLabel: string;
  /** Clinic names the visitor had shortlisted at capture time. */
  clinicNames: string[];
  /** Saved slugs with no live clinic behind them. */
  unresolvedSlugs?: string[];
  profileViewCount?: number;
  path?: string;
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
  /** Outcome of the guide email we just tried to send them. */
  deliveryLabel: string;
  deliveryError?: string;
}

/**
 * Tell the owners a visitor just handed over their address.
 *
 * Same recipients and same shape as the lead notification
 * ({@link resolveLeadRecipients}), with Reply-To set to the subscriber so
 * hitting reply starts a direct conversation. Sent *after* the guide email so
 * the notification can report whether that one actually left, which is the
 * question worth answering in the same breath.
 *
 * Owners-only: the subscriber never sees this, and it is the only place their
 * address travels besides the record and their own guide email.
 */
export async function sendCaptureNotificationEmail({
  capture,
  manageUrl,
}: {
  capture: CaptureNotificationData;
  manageUrl?: string;
}): Promise<SendResult> {
  const to = await resolveLeadRecipients();

  const shortlist = capture.clinicNames.length
    ? capture.clinicNames.join(", ")
    : "Nothing saved yet";

  const fields: [string, string | undefined | null][] = [
    ["Email", capture.email],
    ["Trigger", capture.triggerLabel],
    ["Shortlist", shortlist],
    ["Unavailable slugs", capture.unresolvedSlugs?.join(", ")],
    [
      "Clinic profiles viewed",
      capture.profileViewCount == null
        ? undefined
        : String(capture.profileViewCount),
    ],
    ["Captured on", capture.path],
    ["Referrer", capture.referrer],
    [
      "Campaign",
      [capture.utm?.source, capture.utm?.medium, capture.utm?.campaign]
        .filter(Boolean)
        .join(" / ") || undefined,
    ],
    ["Guide email", capture.deliveryLabel],
    ["Delivery error", capture.deliveryError],
  ];

  const textLines = fields
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([label, value]) => `${label}: ${value}`);
  if (manageUrl) textLines.push(`\nManage: ${manageUrl}`);

  return sendEmail({
    to,
    replyTo: capture.email,
    subject: `New guide signup: ${capture.email} | ${SITE_NAME}`,
    html: layout(
      "New guide signup",
      `<p style="margin:0 0 16px;color:#5C7388;">Someone asked for their shortlist and the 12 questions. Their copy has already been sent, so no action is needed unless the delivery below failed.</p>
       <table style="width:100%;border-collapse:collapse;">${detailRows(fields)}</table>
       ${manageUrl ? `<p style="margin:24px 0 0;">${button(manageUrl, "Open in admin")}</p>` : ""}`,
      `Internal notification for the ${SITE_NAME} owners. Replying goes to the subscriber.`,
    ),
    text: `New guide signup via ${SITE_NAME}\n\n` + textLines.join("\n"),
  });
}
