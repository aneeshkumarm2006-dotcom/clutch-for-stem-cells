/**
 * Public form config `/api/form-config`.
 *
 * Serves the *public* captcha site key to the browser so the widget can be
 * injected at runtime rather than baked into page markup. That matters here:
 * this repo has generated pages and golden-file content tests, so a markup
 * change costs a migration while an env var costs nothing. Add the keys in
 * Vercel, redeploy, and the widget appears — no code edit.
 *
 * Returns `{ captcha: null }` when no site key is configured, which is the
 * signal the client uses to skip the widget entirely.
 *
 * Cached at the edge briefly: the value only changes on redeploy, and the
 * forms fetch it on mount.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface FormConfigResponse {
  captcha: { provider: "turnstile" | "hcaptcha"; siteKey: string } | null;
}

export function GET(): NextResponse<FormConfigResponse> {
  const siteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY?.trim();
  const provider =
    process.env.CAPTCHA_PROVIDER === "hcaptcha" ? "hcaptcha" : "turnstile";

  return NextResponse.json(
    { captcha: siteKey ? { provider, siteKey } : null },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
