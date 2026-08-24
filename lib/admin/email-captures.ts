/**
 * Guide-capture read layer for `/admin/captures`.
 *
 * Every address the capture modal collected, with the whole context around it:
 * which trigger produced it, what the visitor had shortlisted (resolved to
 * clinic names, with the raw slugs kept for anything that has since been
 * unpublished), where they were, and whether the promised email actually left.
 *
 * The funnel strip above the table mixes two sources on purpose, and says so in
 * the UI: `submitted` is counted from this collection and is exact, while
 * `shown`/`dismissed` come from the consent-gated `AnalyticsEvent` beacon and
 * therefore undercount. Presenting a conversion rate without that caveat would
 * be the wrong number confidently displayed.
 */
import "server-only";
import { cache } from "react";
import type { FilterQuery } from "mongoose";

import { dbConnect } from "@/lib/db";
import { DEFAULT_PAGE_SIZE, id, iso, type Paginated } from "@/lib/admin/serialize";
import { AnalyticsEvent, Clinic, EmailCapture } from "@/models";
import type { IEmailCapture } from "@/models";
import type {
  CaptureDelivery,
  CaptureStatus,
  CaptureTrigger,
} from "@/lib/enums";

export interface AdminCaptureClinic {
  id: string;
  name: string;
  slug: string;
}

export interface AdminCaptureRow {
  id: string;
  email: string;
  trigger: CaptureTrigger;
  status: CaptureStatus;
  delivery: CaptureDelivery;
  deliveryError?: string;
  sentAt?: string;
  /** When the owners were emailed about this signup. Absent means never. */
  ownerNotifiedAt?: string;
  resendCount: number;
  shortlistCount: number;
  /** Saved slugs that still resolve to a clinic, with display names. */
  clinics: AdminCaptureClinic[];
  /** Saved slugs with no live clinic behind them (renamed or unpublished). */
  unresolvedSlugs: string[];
  profileViewCount?: number;
  path?: string;
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  internalNote?: string;
  capturedAt?: string;
  /** Earlier captures from the same address, so a repeat is obvious. */
  priorCaptures: number;
}

export type CaptureCounts = Record<CaptureStatus | "all", number>;

export interface CaptureFunnel {
  windowDays: number;
  /** Consent-gated, so a floor rather than a count. */
  shown: number;
  dismissed: number;
  /** Exact: read from the capture records themselves. */
  submitted: number;
  /** `submitted / shown`, or null when there is nothing to divide by. */
  conversionRate: number | null;
}

export interface CapturesResult extends Paginated<AdminCaptureRow> {
  counts: CaptureCounts;
  funnel: CaptureFunnel;
  /** Delivery problems across every status, for the header warning. */
  failedDeliveries: number;
  /** Signups the owners were never told about, for the header warning. */
  unnotified: number;
}

/** New, untriaged captures — drives the sidebar count if one is ever wired. */
export const getNewCaptureCount = cache(async (): Promise<number> => {
  await dbConnect();
  return EmailCapture.countDocuments({ status: "new" });
});

export interface CapturesQuery {
  status?: string;
  trigger?: string;
  delivery?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

function buildFilter(query: CapturesQuery): FilterQuery<IEmailCapture> {
  const filter: FilterQuery<IEmailCapture> = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status as CaptureStatus;
  }
  if (query.trigger) filter.trigger = query.trigger as CaptureTrigger;
  if (query.delivery) filter.delivery = query.delivery as CaptureDelivery;
  if (query.q?.trim()) {
    // Escaped: an operator pasting an address with a "+" tag must not compile
    // into a quantifier and blow up the query.
    const escaped = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.email = { $regex: escaped, $options: "i" };
  }
  return filter;
}

export async function getAdminCaptures(
  query: CapturesQuery = {},
): Promise<CapturesResult> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const filter = buildFilter(query);

  const [docs, total, countsAgg, failedDeliveries, unnotified, funnel] =
    await Promise.all([
      EmailCapture.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      EmailCapture.countDocuments(filter),
      EmailCapture.aggregate<{ _id: CaptureStatus; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      EmailCapture.countDocuments({ delivery: "failed" }),
      EmailCapture.countDocuments({ ownerNotifiedAt: null }),
      getCaptureFunnel(),
    ]);

  // Batch-resolve the shortlisted clinics for the page of rows on screen.
  const allSlugs = [...new Set(docs.flatMap((d) => d.shortlistSlugs ?? []))];
  const clinics = allSlugs.length
    ? await Clinic.find({ slug: { $in: allSlugs } })
        .select("name slug")
        .lean()
    : [];
  const bySlug = new Map(clinics.map((c) => [c.slug, c]));

  // "Has this address been seen before?" for the page of rows on screen.
  const emails = [...new Set(docs.map((d) => d.email))];
  const priorAgg = emails.length
    ? await EmailCapture.aggregate<{ _id: string; count: number }>([
        { $match: { email: { $in: emails } } },
        { $group: { _id: "$email", count: { $sum: 1 } } },
      ])
    : [];
  const seenByEmail = new Map(priorAgg.map((r) => [r._id, r.count]));

  const rows: AdminCaptureRow[] = docs.map((d) => {
    const slugs = d.shortlistSlugs ?? [];
    const resolved: AdminCaptureClinic[] = [];
    const unresolved: string[] = [];
    for (const slug of slugs) {
      const clinic = bySlug.get(slug);
      if (clinic) {
        resolved.push({ id: id(clinic._id), name: clinic.name, slug });
      } else {
        unresolved.push(slug);
      }
    }

    return {
      id: id(d._id),
      email: d.email,
      trigger: d.trigger,
      status: d.status,
      delivery: d.delivery,
      deliveryError: d.deliveryError,
      sentAt: iso(d.sentAt),
      ownerNotifiedAt: iso(d.ownerNotifiedAt),
      resendCount: d.resendCount ?? 0,
      shortlistCount: d.shortlistCount ?? slugs.length,
      clinics: resolved,
      unresolvedSlugs: unresolved,
      profileViewCount: d.profileViewCount,
      path: d.path,
      referrer: d.referrer,
      utm: d.utm
        ? {
            source: d.utm.source,
            medium: d.utm.medium,
            campaign: d.utm.campaign,
            term: d.utm.term,
            content: d.utm.content,
          }
        : undefined,
      internalNote: d.internalNote,
      capturedAt: iso(d.createdAt),
      // Minus this one, so 0 means "first time we've seen this address".
      priorCaptures: Math.max(0, (seenByEmail.get(d.email) ?? 1) - 1),
    };
  });

  const counts: CaptureCounts = {
    new: 0,
    archived: 0,
    unsubscribed: 0,
    spam: 0,
    all: 0,
  };
  for (const row of countsAgg) {
    if (row._id in counts) counts[row._id] = row.count;
    counts.all += row.count;
  }

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts,
    funnel,
    failedDeliveries,
    unnotified,
  };
}

/**
 * Impressions, dismissals, and submissions over a trailing window. Returns
 * zeroes rather than throwing when the event store is empty or unreachable, so
 * a analytics outage costs the strip and not the page.
 */
export async function getCaptureFunnel(windowDays = 30): Promise<CaptureFunnel> {
  const empty: CaptureFunnel = {
    windowDays,
    shown: 0,
    dismissed: 0,
    submitted: 0,
    conversionRate: null,
  };
  try {
    await dbConnect();
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const [events, submitted] = await Promise.all([
      AnalyticsEvent.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            name: { $in: ["guide_modal_shown", "guide_modal_dismissed"] },
            createdAt: { $gte: since },
          },
        },
        { $group: { _id: "$name", count: { $sum: 1 } } },
      ]),
      EmailCapture.countDocuments({ createdAt: { $gte: since } }),
    ]);
    const byName = new Map(events.map((e) => [e._id, e.count]));
    const shown = byName.get("guide_modal_shown") ?? 0;
    return {
      windowDays,
      shown,
      dismissed: byName.get("guide_modal_dismissed") ?? 0,
      submitted,
      conversionRate: shown > 0 ? submitted / shown : null,
    };
  } catch {
    return empty;
  }
}

export interface CaptureExportRow {
  email: string;
  trigger: CaptureTrigger;
  status: CaptureStatus;
  delivery: CaptureDelivery;
  sentAt?: string;
  ownerNotifiedAt?: string;
  shortlistCount: number;
  shortlistSlugs: string;
  profileViewCount?: number;
  path?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  internalNote?: string;
  capturedAt?: string;
}

/** Every row matching the current filters, newest first, for the CSV. */
export async function getCapturesForExport(
  query: CapturesQuery = {},
): Promise<CaptureExportRow[]> {
  await dbConnect();
  const docs = await EmailCapture.find(buildFilter(query))
    .sort({ createdAt: -1 })
    .limit(10_000)
    .lean();

  return docs.map((d) => ({
    email: d.email,
    trigger: d.trigger,
    status: d.status,
    delivery: d.delivery,
    sentAt: iso(d.sentAt),
    ownerNotifiedAt: iso(d.ownerNotifiedAt),
    shortlistCount: d.shortlistCount ?? 0,
    shortlistSlugs: (d.shortlistSlugs ?? []).join("; "),
    profileViewCount: d.profileViewCount,
    path: d.path,
    referrer: d.referrer,
    utmSource: d.utm?.source,
    utmMedium: d.utm?.medium,
    utmCampaign: d.utm?.campaign,
    internalNote: d.internalNote,
    capturedAt: iso(d.createdAt),
  }));
}
