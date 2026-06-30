/**
 * Analytics — server-side event sink + config + per-clinic aggregation
 * (Stage 3.9 seam, Stage 9.2/9.3 / PRD §15).
 *
 * Two destinations, both best-effort (analytics must never break a request):
 *   1. The structured server log (always).
 *   2. The `AnalyticsEvent` collection — durable, PII-free, TTL-bounded — which
 *      powers the admin's per-clinic metrics (Stage 9.3).
 *
 * Client-side product analytics (GA4 / Plausible / PostHog) are loaded in the
 * browser by `components/analytics/analytics-scripts.tsx`, gated on cookie
 * consent and configured from {@link getAnalyticsConfig}. This module is the
 * *server* sink; keep PII out of every event (PRD §13 — ids and hostnames, not
 * emails or IPs).
 */
import "server-only";
import { cache } from "react";
import { Types } from "mongoose";

import { dbConnect } from "@/lib/db";
import { AnalyticsEvent, SiteSetting } from "@/models";
import type { AnalyticsEventName } from "@/models";

function toObjectId(id?: string | null): Types.ObjectId | null {
  if (!id || !Types.ObjectId.isValid(id)) return null;
  return new Types.ObjectId(id);
}

/**
 * Persist one event to the durable store. Never throws — a failed write must not
 * surface to the caller (PRD §13/Stage 9.7). Connects lazily so it works from
 * route handlers and Server Components alike.
 */
async function recordAnalyticsEvent(
  name: AnalyticsEventName,
  clinicId: string | null,
  props: Record<string, unknown>,
): Promise<void> {
  try {
    await dbConnect();
    await AnalyticsEvent.create({
      name,
      clinicId: toObjectId(clinicId),
      props,
    });
  } catch {
    // Best-effort: swallow (e.g. DB unavailable, build-time prerender).
  }
}

/** Fire an analytics event: log + durable store. Never throws. */
export async function trackEvent(
  name: AnalyticsEventName,
  props: Record<string, unknown> = {},
): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.info(`[analytics] ${name}`, JSON.stringify(props));
  } catch {
    /* logging is best-effort */
  }
  const { clinicId, ...rest } = props as { clinicId?: string };
  await recordAnalyticsEvent(name, clinicId ?? null, rest);
}

/** Tracked outbound click to a clinic's website (PRD §7). */
export function trackOutboundClick(props: {
  clinicId: string;
  slug?: string;
  destinationHost?: string;
}): Promise<void> {
  return trackEvent("outbound_click", props);
}

// ── Analytics provider config (admin Settings → env fallback) ────────────────

export interface ResolvedAnalyticsConfig {
  ga4Id?: string;
  plausibleDomain?: string;
  posthogKey?: string;
  posthogHost: string;
}

/**
 * Resolve the analytics provider config: admin Settings first (PRD §15), then
 * `NEXT_PUBLIC_*` env vars as build-time fallbacks. Cached per request so the
 * public layout reads it once. Empty strings are treated as unset.
 */
export const getAnalyticsConfig = cache(
  async (): Promise<ResolvedAnalyticsConfig> => {
    const clean = (v?: string): string | undefined => {
      const t = v?.trim();
      return t ? t : undefined;
    };
    let settings: { ga4Id?: string; plausibleDomain?: string; posthogKey?: string } = {};
    try {
      await dbConnect();
      const doc = await SiteSetting.getGlobal();
      settings = doc.analytics ?? {};
    } catch {
      // Settings unavailable — fall back to env only.
    }
    return {
      ga4Id: clean(settings.ga4Id) ?? clean(process.env.NEXT_PUBLIC_GA4_ID),
      plausibleDomain:
        clean(settings.plausibleDomain) ??
        clean(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN),
      posthogKey:
        clean(settings.posthogKey) ?? clean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
      posthogHost:
        clean(process.env.NEXT_PUBLIC_POSTHOG_HOST) ??
        "https://us.i.posthog.com",
    };
  },
);

// ── Per-clinic aggregation (Stage 9.3 admin) ─────────────────────────────────

export interface ClinicAnalyticsSummary {
  windowDays: number;
  profileViews: number;
  outboundClicks: number;
  leads: number;
  reviews: number;
  /** Daily profile-view series for a small sparkline (oldest → newest). */
  viewsSeries: { label: string; count: number }[];
}

/**
 * Aggregate a clinic's recent events for the admin profile (Stage 9.3). Reads a
 * trailing `windowDays` window from the bounded event store. Returns zeroes (not
 * an error) when analytics is empty or the DB is unavailable.
 */
export async function getClinicAnalytics(
  clinicId: string,
  windowDays = 30,
): Promise<ClinicAnalyticsSummary> {
  const empty: ClinicAnalyticsSummary = {
    windowDays,
    profileViews: 0,
    outboundClicks: 0,
    leads: 0,
    reviews: 0,
    viewsSeries: [],
  };
  const _id = toObjectId(clinicId);
  if (!_id) return empty;

  try {
    await dbConnect();
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const [byName, viewsByDay] = await Promise.all([
      AnalyticsEvent.aggregate<{ _id: AnalyticsEventName; count: number }>([
        { $match: { clinicId: _id, createdAt: { $gte: since } } },
        { $group: { _id: "$name", count: { $sum: 1 } } },
      ]),
      AnalyticsEvent.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            clinicId: _id,
            name: "profile_view",
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const counts = new Map(byName.map((r) => [r._id, r.count]));
    return {
      windowDays,
      profileViews: counts.get("profile_view") ?? 0,
      outboundClicks: counts.get("outbound_click") ?? 0,
      leads: counts.get("lead_submit") ?? 0,
      reviews: counts.get("review_submit") ?? 0,
      viewsSeries: viewsByDay.map((r) => ({
        label: r._id.slice(5), // MM-DD
        count: r.count,
      })),
    };
  } catch {
    return empty;
  }
}
