/**
 * Transactional email — Stage 2.2 (auth) via Resend.
 *
 * `sendEmail` is the low-level sender; the `send*` helpers below build the
 * auth templates (verification + password reset). When `RESEND_API_KEY` is
 * unset (local dev), emails are logged to the server console instead of sent,
 * so the verification / reset flows are fully testable without a Resend account.
 *
 * Stage 3.5 extends this module with lead-notification and review-status
 * templates (PRD §6 / §8); keep new templates in this file.
 */
import { Resend } from "resend";

import { SITE_NAME, SITE_URL } from "@/config/site";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? `${SITE_NAME} <onboarding@resend.dev>`;

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback (also what's logged in dev). */
  text: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailInput): Promise<void> {
  if (!resend) {
    // Dev fallback — no API key configured. Surface the content (incl. links).
    // eslint-disable-next-line no-console
    console.info(
      `\n📧 [email:dev] (RESEND_API_KEY unset — not sent)\n  To: ${to}\n  Subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}\n`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
  if (error) {
    throw new Error(`Resend failed to send "${subject}": ${error.message}`);
  }
}

// ── Shared layout ────────────────────────────────────────────────────────────

/** Minimal on-brand HTML shell (Azure Clinical tokens, inline styles for email). */
function layout(heading: string, bodyHtml: string): string {
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
        ${SITE_NAME} is an informational directory, not a medical provider. This email was sent for account security.
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

export function verifyEmailUrl(token: string): string {
  return `${SITE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export function resetPasswordUrl(token: string): string {
  return `${SITE_URL}/auth/reset?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const url = verifyEmailUrl(token);
  await sendEmail({
    to,
    subject: `Verify your ${SITE_NAME} email`,
    html: layout(
      "Verify your email",
      `<p style="margin:0 0 20px;color:#5C7388;">Confirm this address to finish setting up your account.</p>
       ${button(url, "Verify email")}
       <p style="margin:20px 0 0;color:#90AAC0;font-size:13px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
    ),
    text: `Verify your ${SITE_NAME} email by opening this link (expires in 24 hours):\n${url}\n\nIf you didn't create an account, you can ignore this email.`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const url = resetPasswordUrl(token);
  await sendEmail({
    to,
    subject: `Reset your ${SITE_NAME} password`,
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 20px;color:#5C7388;">Choose a new password for your account.</p>
       ${button(url, "Reset password")}
       <p style="margin:20px 0 0;color:#90AAC0;font-size:13px;">This link expires in 1 hour. If you didn't request a reset, you can ignore this email — your password won't change.</p>`,
    ),
    text: `Reset your ${SITE_NAME} password by opening this link (expires in 1 hour):\n${url}\n\nIf you didn't request a reset, you can ignore this email.`,
  });
}

// ── Lead notification (Stage 3.5 / PRD §6.5, §8.4) ───────────────────────────

/** Human-readable lead fields (caller resolves taxonomy refs to labels first). */
export interface LeadEmailData {
  /** Lead type label, e.g. "Consultation request" or "Clinic match". */
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
}

/**
 * Notify a clinic or admin of a new inquiry. `manageUrl` deep-links to the lead
 * in the admin panel (`/admin/leads/[id]`). Reviewer/contact PII appears only in
 * this internal email, never publicly.
 */
export async function sendLeadNotificationEmail({
  to,
  lead,
  manageUrl,
}: {
  to: string;
  lead: LeadEmailData;
  manageUrl?: string;
}): Promise<void> {
  const subject = lead.clinicName
    ? `New inquiry for ${lead.clinicName} — ${SITE_NAME}`
    : `New ${lead.typeLabel.toLowerCase()} — ${SITE_NAME}`;

  const rows = detailRows([
    ["Type", lead.typeLabel],
    ["Clinic", lead.clinicName],
    ["Name", lead.name],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Country", lead.country],
    ["Condition", lead.conditionLabel],
    ["Treatments", lead.treatmentLabels?.join(", ")],
    ["Budget", lead.budgetRange],
    ["Timeframe", lead.timeframe],
  ]);

  const message = lead.message
    ? `<p style="margin:18px 0 0;color:#5C7388;font-size:13px;">Message</p>
       <p style="margin:4px 0 0;color:#0C2233;white-space:pre-wrap;">${esc(lead.message)}</p>`
    : "";

  await sendEmail({
    to,
    subject,
    html: layout(
      "New inquiry received",
      `<p style="margin:0 0 16px;color:#5C7388;">A new lead just came in through ${SITE_NAME}.</p>
       <table style="width:100%;border-collapse:collapse;">${rows}</table>
       ${message}
       ${manageUrl ? `<p style="margin:24px 0 0;">${button(manageUrl, "Open in admin")}</p>` : ""}`,
    ),
    text:
      `New inquiry via ${SITE_NAME}\n\n` +
      [
        `Type: ${lead.typeLabel}`,
        lead.clinicName && `Clinic: ${lead.clinicName}`,
        `Name: ${lead.name}`,
        `Email: ${lead.email}`,
        lead.phone && `Phone: ${lead.phone}`,
        lead.country && `Country: ${lead.country}`,
        lead.conditionLabel && `Condition: ${lead.conditionLabel}`,
        lead.treatmentLabels?.length &&
          `Treatments: ${lead.treatmentLabels.join(", ")}`,
        lead.budgetRange && `Budget: ${lead.budgetRange}`,
        lead.timeframe && `Timeframe: ${lead.timeframe}`,
        lead.message && `\nMessage:\n${lead.message}`,
        manageUrl && `\nManage: ${manageUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
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
}): Promise<void> {
  if (outcome === "approved") {
    const url = clinicSlug ? `${SITE_URL}/clinic/${clinicSlug}` : SITE_URL;
    await sendEmail({
      to,
      subject: `Your review of ${clinicName} is live`,
      html: layout(
        "Your review is published",
        `<p style="margin:0 0 20px;color:#5C7388;">Thanks for sharing your experience with ${esc(clinicName)}. Your review has been approved and is now live.</p>
         ${button(url, "View your review")}
         <p style="margin:20px 0 0;color:#90AAC0;font-size:13px;">Reviews are informational and reflect individual experiences; results vary.</p>`,
      ),
      text: `Thanks for sharing your experience with ${clinicName}. Your review is now live:\n${url}\n\nReviews are informational and reflect individual experiences; results vary.`,
    });
    return;
  }

  const reason = rejectionReason
    ? `<p style="margin:16px 0 0;color:#5C7388;font-size:13px;">Reason</p>
       <p style="margin:4px 0 0;color:#0C2233;">${esc(rejectionReason)}</p>`
    : "";
  await sendEmail({
    to,
    subject: `About your review of ${clinicName}`,
    html: layout(
      "We couldn't publish your review",
      `<p style="margin:0 0 4px;color:#5C7388;">Thanks for taking the time to review ${esc(clinicName)}. After moderation, we weren't able to publish it.</p>
       ${reason}
       <p style="margin:20px 0 0;color:#90AAC0;font-size:13px;">If you think this was a mistake, reply to this email and our team will take another look.</p>`,
    ),
    text:
      `Thanks for reviewing ${clinicName}. After moderation, we weren't able to publish your review.` +
      (rejectionReason ? `\n\nReason: ${rejectionReason}` : "") +
      `\n\nIf you think this was a mistake, reply to this email and our team will take another look.`,
  });
}
