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
}

export interface TaxonomyView {
  segment: string;
  label: string;
  singular: string;
  hasCategory: boolean;
  hasIssuingBody: boolean;
  isLocation: boolean;
  rows: AdminTaxonomyRow[];
  parentOptions: { value: string; label: string }[];
}

function toRow(d: Record<string, unknown>): AdminTaxonomyRow {
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
  };
}

export async function getTaxonomyView(
  segment: string,
): Promise<TaxonomyView | null> {
  const config = getTaxonomyConfig(segment);
  if (!config) return null;
  await dbConnect();

  const docs = await config.model
    .find({})
    .sort({ order: 1, name: 1 })
    .lean();
  const rows = (docs as unknown as Record<string, unknown>[]).map(toRow);

  return {
    segment: config.segment,
    label: config.label,
    singular: config.singular,
    hasCategory: Boolean(config.hasCategory),
    hasIssuingBody: Boolean(config.hasIssuingBody),
    isLocation: Boolean(config.isLocation),
    rows,
    parentOptions: rows.map((r) => ({ value: r.id, label: r.name })),
  };
}

export type { TaxonomyConfig };
