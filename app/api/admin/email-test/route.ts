/**
 * Email diagnostics `/api/admin/email-test` (Admin+).
 *
 * Delivery failures are swallowed by design (a mail outage must never fail a
 * lead submission), so a misconfigured deploy looks exactly like a working
 * one. This route makes the difference visible:
 *
 *   GET  — report which SMTP env vars actually landed, the resolved owner
 *          recipients, and the result of `verifyTransport()` (connects and
 *          authenticates, sends nothing).
 *   POST — send one real test message to the configured owner recipients.
 *
 * The password value is never echoed — length only, which is enough to catch
 * a value that arrived wrapped in quotes, with spaces, or truncated.
 */
import { SITE_NAME, SITE_URL } from "@/config/site";
import { ok, withRole } from "@/lib/admin/api";
import {
  resolveLeadRecipients,
  sendEmail,
  verifyTransport,
} from "@/lib/email";

export const dynamic = "force-dynamic";
// SMTP needs TCP sockets (Node runtime) and headroom beyond the default
// function timeout — same as the lead capture route.
export const runtime = "nodejs";
export const maxDuration = 30;

function envReport(): Record<string, string> {
  const pass = process.env.SMTP_PASS ?? "";
  return {
    SMTP_HOST: process.env.SMTP_HOST || "(default) smtp.gmail.com",
    SMTP_PORT: process.env.SMTP_PORT || "(default) 465",
    SMTP_USER: process.env.SMTP_USER || "(unset)",
    SMTP_PASS: pass ? `set, ${pass.length} chars` : "(unset)",
    EMAIL_FROM: process.env.EMAIL_FROM || "(unset — falls back to SMTP_USER)",
    LEADS_NOTIFY_EMAIL:
      process.env.LEADS_NOTIFY_EMAIL ||
      "(unset — falls back to Settings → contact email)",
  };
}

export async function GET(): Promise<Response> {
  return withRole("admin", async () => {
    const [verify, recipients] = await Promise.all([
      verifyTransport(),
      resolveLeadRecipients(),
    ]);
    return ok({ env: envReport(), recipients, verify });
  });
}

export async function POST(): Promise<Response> {
  return withRole("admin", async (user) => {
    const recipients = await resolveLeadRecipients();
    const result = await sendEmail({
      to: recipients,
      subject: `Test notification | ${SITE_NAME}`,
      html: `<p>SMTP test message from <a href="${SITE_URL}">${SITE_NAME}</a>, requested by ${user.email ?? "an admin"} via /admin.</p>
<p>If this arrived, owner lead notifications are configured correctly.</p>`,
      text: `SMTP test message from ${SITE_NAME} (${SITE_URL}), requested by ${user.email ?? "an admin"} via /admin.\n\nIf this arrived, owner lead notifications are configured correctly.`,
    });
    return ok({ recipients, result });
  });
}
