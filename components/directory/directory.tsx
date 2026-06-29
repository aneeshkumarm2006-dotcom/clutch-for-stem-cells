import * as React from "react";
import Link from "next/link";
import { ChevronRight, SearchX, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { DirectoryTabs } from "@/components/ui/directory-tabs";
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
}: DirectoryProps) {
  const ratingsUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tabHref = (view: "all" | "top") =>
    view === "top" ? `${basePath}?view=top` : basePath;

  return (
    <div className="container py-8 md:py-10">
      {breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1 text-[13px] text-text-muted">
            {breadcrumbs.map((b, i) => (
              <li key={b.href} className="flex items-center gap-1">
                {i > 0 ? (
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                ) : null}
                {i < breadcrumbs.length - 1 ? (
                  <Link
                    href={b.href}
                    className="transition-colors hover:text-text-secondary"
                  >
                    {b.name}
                  </Link>
                ) : (
                  <span className="text-text-secondary">{b.name}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
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
          Ratings updated {ratingsUpdated}. Verification is accreditation-based —{" "}
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

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
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
                title="No clinics match these filters yet"
                description="Try broadening your search or clearing a filter or two — or let us match you with clinics that fit."
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
          <aside className="mt-10 flex flex-col items-start gap-3 rounded-xl border border-azure-200 bg-tint/40 p-5 sm:flex-row sm:items-center sm:justify-between">
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
    </div>
  );
}
