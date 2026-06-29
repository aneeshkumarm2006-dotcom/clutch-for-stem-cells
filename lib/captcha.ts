/**
 * Captcha verification — hCaptcha or Cloudflare Turnstile (Stage 3.7 / PRD §13).
 *
 * Server-side `siteverify` for the token a public form submits. Provider is
 * chosen by `CAPTCHA_PROVIDER` (defaults to Turnstile). When `CAPTCHA_SECRET_KEY`
 * is unset (local dev), verification passes with a console warning so forms are
 * testable without a captcha account — consistent with the rest of `/lib`.
 */

export type CaptchaProvider = "turnstile" | "hcaptcha";

const SECRET = process.env.CAPTCHA_SECRET_KEY;

const VERIFY_URLS: Record<CaptchaProvider, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  hcaptcha: "https://hcaptcha.com/siteverify",
};

function provider(): CaptchaProvider {
  return process.env.CAPTCHA_PROVIDER === "hcaptcha" ? "hcaptcha" : "turnstile";
}

/** True when a captcha secret is configured (else verification is bypassed). */
export function isCaptchaConfigured(): boolean {
  return Boolean(SECRET);
}

export interface CaptchaResult {
  success: boolean;
  errorCodes?: string[];
}

interface SiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verify a captcha `token` (optionally binding to the client IP). Never throws —
 * a transport failure resolves to `{ success: false }` so the caller decides how
 * to respond. Returns `success: true` in dev when no secret is set.
 */
export async function verifyCaptcha(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<CaptchaResult> {
  if (!isCaptchaConfigured()) {
    // eslint-disable-next-line no-console
    console.warn(
      "[captcha] CAPTCHA_SECRET_KEY unset — skipping verification (dev).",
    );
    return { success: true };
  }
  if (!token) return { success: false, errorCodes: ["missing-input-response"] };

  try {
    const body = new URLSearchParams({
      secret: SECRET as string,
      response: token,
    });
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(VERIFY_URLS[provider()], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as SiteVerifyResponse;
    return { success: Boolean(data.success), errorCodes: data["error-codes"] };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Captcha verification failed:", err);
    return { success: false, errorCodes: ["internal-error"] };
  }
}
