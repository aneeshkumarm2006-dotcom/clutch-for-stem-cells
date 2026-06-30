/**
 * Public analytics beacon `/api/track` (Stage 9.2 / PRD §15).
 *
 * Receives non-PII, consent-gated events from the browser (profile views, filter
 * usage) and forwards them to the server analytics sink (`lib/analytics`). The
 * client only POSTs after the visitor has accepted analytics cookies, so this
 * endpoint trusts that gate but still: validates against an allowlist (Zod),
 * rate-limits per IP to prevent flooding, and stores no IP/PII. Best-effort —
 * always returns 204 so a tracking failure never affects the page.
 */
import { trackEvent } from "@/lib/analytics";
import { guardPublicForm } from "@/lib/public-form";
import { trackEventSchema } from "@/lib/validation/track";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // Generous per-IP cap; no captcha (beacons fire automatically on navigation).
  const blocked = await guardPublicForm(req, {
    action: "track",
    requireCaptcha: false,
    limit: 120,
    windowSeconds: 600,
  });
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const parsed = trackEventSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 204 });

  const { name, clinicId, props } = parsed.data;
  await trackEvent(name, { ...(props ?? {}), ...(clinicId ? { clinicId } : {}) });

  return new Response(null, { status: 204 });
}
