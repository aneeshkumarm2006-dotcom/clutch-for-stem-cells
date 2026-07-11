/**
 * Taxonomy read-layer (PRD §8.5 / Stage 6.7).
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { id } from "@/lib/admin/serialize";
import {
  getTaxonomyConfig,
  type TaxonomyConfig,
} from "@/lib/admin/taxonomy-config";
import { getReviewerOptions } from "@/lib/seoteam/reviewer-data";
import type { TaxonomyKind } from "@/lib/enums";

export interface EditorialFaqRow {
  question: string;
  answer: string;
}
export interface EditorialKeyFactRow {
  label: string;
  value: string;
  sourceUrl?: string;
}

export interface AdminTaxonomyRow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  icon?: string;
  parentId?: string;
  order: number;
  isActive: boolean;
  clinicCount: number;
  category?: string;
  issuingBody?: string;
  kind?: string;
  countryCode?: string;
  region?: string;
  flag?: string;
  lat?: number;
  lng?: number;
  // ── SEO overrides (per-term `seo`; win over the auto title/description) ──
  metaTitle?: string;
  metaDescription?: string;
  // ── Editorial enrichment (see B5 / lib/content-review.ts gate) ──
  body?: string;
  faqs: EditorialFaqRow[];
  keyFacts: EditorialKeyFactRow[];
  reviewStatus: string;
  reviewedBy?: string;
  flagsAcknowledged: boolean;
  contentFlags: { phrase: string; context: string }[];
  // Treatment
  mechanism?: string;
  evidenceLevel?: string;
  evidenceSummary?: string;
  costRange?: string;
  recoveryTimeline?: string;
  risks?: string;
  // Condition
  overview?: string;
  standardOfCare?: string;
  evidenceForCellTherapy?: string;
  symptoms: string[];
  // Location
  regulatoryStatus?: string;
  logistics?: string;
  travelNotes?: string;
}

export interface TaxonomyView {
  segment: string;
  /** Taxonomy kind — drives which editorial extras the form shows. */
  kind: TaxonomyKind;
  label: string;
  singular: string;
  hasCategory: boolean;
  hasIssuingBody: boolean;
  isLocation: boolean;
  rows: AdminTaxonomyRow[];
  parentOptions: { value: string; label: string }[];
  /** Active reviewers for the editorial approval picker. */
  reviewers: { id: string; name: string; credentials?: string }[];
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v ? v : undefined;

function toRow(d: Record<string, unknown>): AdminTaxonomyRow {
  const seo =
    (d.seo as { metaTitle?: string; metaDescription?: string } | undefined) ??
    undefined;
  return {
    id: id(d._id),
    name: d.name as string,
    slug: d.slug as string,
    description: (d.description as string) ?? "",
    shortDescription: (d.shortDescription as string) ?? "",
    icon: (d.icon as string) ?? "",
    parentId: d.parentId ? id(d.parentId) : undefined,
    order: (d.order as number) ?? 0,
    isActive: Boolean(d.isActive),
    clinicCount: (d.clinicCount as number) ?? 0,
    category: (d.category as string) ?? undefined,
    issuingBody: (d.issuingBody as string) ?? undefined,
    kind: (d.kind as string) ?? undefined,
    countryCode: (d.countryCode as string) ?? undefined,
    region: (d.region as string) ?? undefined,
    flag: (d.flag as string) ?? undefined,
    lat: d.lat as number | undefined,
    lng: d.lng as number | undefined,
    metaTitle: str(seo?.metaTitle),
    metaDescription: str(seo?.metaDescription),
    // Editorial
    body: str(d.body),
    faqs: ((d.faqs as EditorialFaqRow[] | undefined) ?? []).map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    keyFacts: ((d.keyFacts as EditorialKeyFactRow[] | undefined) ?? []).map(
      (k) => ({ label: k.label, value: k.value, sourceUrl: k.sourceUrl }),
    ),
    reviewStatus: (d.reviewStatus as string) ?? "draft",
    reviewedBy: d.reviewedBy ? id(d.reviewedBy) : undefined,
    flagsAcknowledged: Boolean(d.flagsAcknowledged),
    contentFlags: (
      (d.contentFlags as { phrase: string; context: string }[] | undefined) ??
      []
    ).map((c) => ({ phrase: c.phrase, context: c.context })),
    mechanism: str(d.mechanism),
    evidenceLevel: str(d.evidenceLevel),
    evidenceSummary: str(d.evidenceSummary),
    costRange: str(d.costRange),
    recoveryTimeline: str(d.recoveryTimeline),
    risks: str(d.risks),
    overview: str(d.overview),
    standardOfCare: str(d.standardOfCare),
    evidenceForCellTherapy: str(d.evidenceForCellTherapy),
    symptoms: ((d.symptoms as string[] | undefined) ?? []).filter(Boolean),
    regulatoryStatus: str(d.regulatoryStatus),
    logistics: str(d.logistics),
    travelNotes: str(d.travelNotes),
  };
}

export async function getTaxonomyView(
  segment: string,
): Promise<TaxonomyView | null> {
  const config = getTaxonomyConfig(segment);
  if (!config) return null;
  await dbConnect();

  const [docs, reviewers] = await Promise.all([
    config.model.find({}).sort({ order: 1, name: 1 }).lean(),
    getReviewerOptions(),
  ]);
  const rows = (docs as unknown as Record<string, unknown>[]).map(toRow);

  return {
    segment: config.segment,
    kind: config.kind,
    label: config.label,
    singular: config.singular,
    hasCategory: Boolean(config.hasCategory),
    hasIssuingBody: Boolean(config.hasIssuingBody),
    isLocation: Boolean(config.isLocation),
    rows,
    parentOptions: rows.map((r) => ({ value: r.id, label: r.name })),
    reviewers,
  };
}

export type { TaxonomyConfig };
