import * as React from "react";
import Link from "next/link";
import { SearchX, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { FilterRail } from "@/components/directory/filter-rail";
import {
  ActiveFilters,
  DirectoryFilters,
  DirectorySort,
  type FilterDimension,
} from "@/components/directory/directory-controls";
import { ClinicCardGrid } from "@/components/clinic/savable-clinic-card";
import { formatCount } from "@/lib/format";
import type { DirectoryData } from "@/lib/public-data";

export interface ClinicResultsProps {
  /** Route pathname (no query) — used for "Clear all" + pagination links. */
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  data: DirectoryData;
  locked?: FilterDimension[];
  filterLabels: Record<string, string>;
  /** Empty-state copy override (combo pages phrase it around the combination). */
  emptyTitle?: string;
  emptyDescription?: string;
}

/** Build a query string from the current params with `page` overridden. */
function buildPageHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page") continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
    else if (value != null) sp.set(key, value);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * The faceted clinic list — filter rail + result count/sort + active-filter
 * chips + ranked clinic cards (or an honest empty state) + crawlable pagination
 * + the "Can't decide?" matching CTA. Extracted from `Directory` so combination
 * pages can render editorial content ABOVE this block (which is what keeps a
 * 0-clinic combo page from being thin). Presentation only.
 */
export function ClinicResults({
  basePath,
  searchParams,
  data,
  locked,
  filterLabels,
  emptyTitle = "No clinics match these filters yet",
  emptyDescription = "Try broadening your search or clearing a filter or two — or let us match you with clinics that fit.",
}: ClinicResultsProps) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <FilterRail
        resultCount={data.total}
        activeCount={undefined}
        clearAllHref={basePath}
      >
        <DirectoryFilters facets={data.facets} locked={locked} />
      </FilterRail>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">
              {formatCount(data.total)}
            </span>{" "}
            {data.total === 1 ? "clinic" : "clinics"}
          </p>
          <DirectorySort />
        </div>

        <div className="mt-4">
          <ActiveFilters labels={filterLabels} basePath={basePath} />
        </div>

        <div className="mt-5">
          {data.cards.length ? (
            <ClinicCardGrid clinics={data.cards} columns={2} />
          ) : (
            <EmptyState
              icon={SearchX}
              title={emptyTitle}
              description={emptyDescription}
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild variant="secondary">
                    <Link href={basePath}>Clear filters</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/find-a-clinic">Get matched</Link>
                  </Button>
                </div>
              }
            />
          )}
        </div>

        {data.pageCount > 1 ? (
          <Pagination
            className="mt-10"
            page={data.page}
            totalPages={data.pageCount}
            hrefFor={(p) => buildPageHref(basePath, searchParams, p)}
          />
        ) : null}

        {/* "Can't decide?" matching CTA */}
        <aside className="bg-tint/40 mt-10 flex flex-col items-start gap-3 rounded-xl border border-azure-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-tint text-azure-700">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-[15px] font-semibold text-text-primary">
                Can&apos;t decide?
              </p>
              <p className="text-[13.5px] text-text-secondary">
                Answer a few questions and we&apos;ll match you with clinics
                that fit your condition, budget, and timeframe.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/find-a-clinic">Get matched</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
