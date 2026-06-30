/**
 * Client-side analytics beacon (Stage 9.2).
 *
 * Fires non-PII events to `/api/track` from the browser, but ONLY when the
 * visitor has accepted analytics cookies (PRD §14 / Stage 8.5). Uses
 * `navigator.sendBeacon` when available (survives page unload), falling back to
 * `fetch` with `keepalive`. Never throws — tracking must not break the UI.
 */
import { hasAnalyticsConsent } from "@/components/compliance/cookie-consent";
import type { TRACKABLE_CLIENT_EVENTS } from "@/lib/validation/track";

type ClientEventName = (typeof TRACKABLE_CLIENT_EVENTS)[number];

export function trackClientEvent(
  name: ClientEventName,
  payload: {
    clinicId?: string;
    props?: Record<string, string | number | boolean>;
  } = {},
): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  const body = JSON.stringify({ name, ...payload });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/track",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Best-effort — ignore failures.
  }
}
