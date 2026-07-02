import * as React from "react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { DirectoryTabs } from "@/components/ui/directory-tabs";
import { type FilterDimension } from "@/components/directory/directory-controls";
import { ClinicResults } from "@/components/directory/clinic-results";
import { FilterUseTracker } from "@/components/analytics/filter-use-tracker";
import type { DirectoryData } from "@/lib/public-data";

/** Query keys that are navigation/sort state, not user-applied filters. */
const NON_FILTER_KEYS = new Set(["page", "view"]);

export interface DirectoryBreadcrumb {
  name: string;
  href: string;
}

export interface DirectoryProps {
  heading: string;
  intro?: string;
  /** Route pathname (no query) — used for "Clear all", tabs, and pagination. */
  basePath: string;
  /** Raw incoming query params (preserved when building pagination links). */
  searchParams: Record<string, string | string[] | undefined>;
  data: DirectoryData;
  /** Filter dimensions pinned by the route (hidden in the rail + chips). */
  locked?: FilterDimension[];
  /** slug → label map for the active-filter chips. */
  filterLabels: Record<string, string>;
  breadcrumbs?: DirectoryBreadcrumb[];
  activeView?: "all" | "top";
  /**
   * Full-width content rendered below the results (still inside the container) —
   * used for hub-and-spoke related links, enriched editorial body, and the
   * medical disclaimer on taxonomy/combination pages.
   */
  afterResults?: React.ReactNode;
}

/**
 * Directory — the one shared listing component behind `/clinics`,
 * `/treatments/[slug]`, `/conditions/[slug]`, and `/locations/...` (PRD §6.2).
 * SEO H1 + intro, ratings-updated note, tabs, URL-driven filters, active-filter
 * chips, facet counts, ranked clinic cards, and crawlable pagination.
 */
export function Directory({
  heading,
  intro,
  basePath,
  searchParams,
  data,
  locked,
  filterLabels,
  breadcrumbs,
  activeView = "all",
  afterResults,
}: DirectoryProps) {
  const ratingsUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tabHref = (view: "all" | "top") =>
    view === "top" ? `${basePath}?view=top` : basePath;

  // Active filter dimension names (not values) for the analytics beacon.
  const activeFilterKeys = Object.keys(searchParams)
    .filter((k) => !NON_FILTER_KEYS.has(k) && searchParams[k] != null)
    .sort();

  return (
    <div className="container py-8 md:py-10">
      <FilterUseTracker
        signature={activeFilterKeys.join(",")}
        count={activeFilterKeys.length}
      />
      {breadcrumbs?.length ? (
        <Breadcrumbs items={breadcrumbs} className="mb-4" />
      ) : null}

      <header className="max-w-3xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          {heading}
        </h1>
        {intro ? (
          <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
            {intro}
          </p>
        ) : null}
        <p className="mt-3 text-[12.5px] text-text-muted">
          Ratings updated {ratingsUpdated}. Verification is accreditation-based
          —{" "}
          <Link
            href="/methodology"
            className="font-medium text-text-link hover:underline"
          >
            see our methodology
          </Link>
          .
        </p>
      </header>

      <div className="mt-6">
        <DirectoryTabs
          activeValue={activeView}
          tabs={[
            { label: "All clinics", href: tabHref("all"), value: "all" },
            { label: "Top clinics", href: tabHref("top"), value: "top" },
          ]}
        />
      </div>

      <div className="mt-6">
        <ClinicResults
          basePath={basePath}
          searchParams={searchParams}
          data={data}
          locked={locked}
          filterLabels={filterLabels}
        />
      </div>

      {afterResults ? (
        <div className="mt-12 border-t border-border pt-8">{afterResults}</div>
      ) : null}
    </div>
  );
}
