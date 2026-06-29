/**
 * Analytics events — swappable server-side sink (Stage 3.9 seam / PRD §15).
 *
 * The MVP records events to the structured server log. This is the single place
 * Stage 9.2 plugs a real sink (GA4 Measurement Protocol, Plausible, PostHog —
 * configured in admin Settings) without changing call sites. Keep PII out of
 * events (PRD §13: no PII in logs) — pass ids and hostnames, not emails or IPs.
 */

/** Fire an analytics event. Never throws; logging must not break a request. */
export async function trackEvent(
  name: string,
  props: Record<string, unknown> = {},
): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.info(`[analytics] ${name}`, JSON.stringify(props));
    // Stage 9.2: forward to the configured provider here.
  } catch {
    // Swallow — analytics is best-effort.
  }
}

/** Tracked outbound click to a clinic's website (PRD §7). */
export function trackOutboundClick(props: {
  clinicId: string;
  slug?: string;
  destinationHost?: string;
}): Promise<void> {
  return trackEvent("outbound_click", props);
}
