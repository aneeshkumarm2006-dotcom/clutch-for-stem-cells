import * as React from "react";
import Link from "next/link";
import {
  Activity,
  Archive,
  ArrowRight,
  Baby,
  Bone,
  Droplet,
  FlaskConical,
  Layers,
  RefreshCw,
  Sparkles,
  Stethoscope,
  Syringe,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import type { TaxonomyTerm } from "@/lib/public-data";

/** Seed icon names → Lucide components (Design §8); falls back to Stethoscope. */
const ICONS: Record<string, LucideIcon> = {
  Dna: Sparkles,
  RefreshCw,
  Users,
  Layers,
  Bone,
  Baby,
  Sparkles,
  Droplet,
  FlaskConical,
  Archive,
  Activity,
  Syringe,
  Stethoscope,
};

function resolveIcon(name?: string): LucideIcon {
  return (name && ICONS[name]) || Stethoscope;
}

/**
 * TaxonomyCard — a browse-grid tile for a treatment/condition (Design §10.4
 * sibling). Icon + name + clinic count, links to the term's directory page.
 */
export function TaxonomyCard({
  term,
  basePath,
  className,
}: {
  term: TaxonomyTerm;
  /** e.g. "/treatments" or "/conditions". */
  basePath: string;
  className?: string;
}) {
  const Icon = resolveIcon(term.icon);
  return (
    <Link
      href={`${basePath}/${term.slug}`}
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-azure-200 hover:shadow-md",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-tint text-azure-700">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-semibold leading-snug text-text-primary">
          {term.name}
        </span>
        <span className="mt-0.5 block text-[12.5px] text-text-muted">
          {term.clinicCount > 0
            ? `${formatCount(term.clinicCount)} ${term.clinicCount === 1 ? "clinic" : "clinics"}`
            : "Explore clinics"}
        </span>
      </span>
      <ArrowRight
        className="mt-1 size-4 shrink-0 text-text-muted transition-colors group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  );
}

/** Compact destination tile (flag + country + clinic count) for the homepage. */
export function DestinationCard({
  name,
  slug,
  flag,
  clinicCount,
}: {
  name: string;
  slug: string;
  flag?: string;
  clinicCount: number;
}) {
  return (
    <Link
      href={`/locations/${slug}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-azure-200 hover:shadow-md"
    >
      <span className="text-2xl" aria-hidden="true">
        {flag ?? "🌍"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-semibold text-text-primary">
          {name}
        </span>
        <span className="text-[12.5px] text-text-muted">
          {clinicCount > 0
            ? `${formatCount(clinicCount)} ${clinicCount === 1 ? "clinic" : "clinics"}`
            : "Explore clinics"}
        </span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-text-muted transition-colors group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  );
}
