"use client";

/**
 * Directory filter controls (Stage 5.2 / PRD §6.2). **All filter state lives in
 * the URL query params** (SSR-friendly + shareable): every control reads the
 * current params and pushes an updated query string, which re-renders the server
 * directory. Renders inside the responsive `FilterRail` shell.
 *
 * Param contract matches `parseClinicSearchParams` (lib/search.ts): list params
 * (`treatment`, `condition`, `cellSource`, `language`) are comma-joined; scalars
 * are `country`, `city`, `priceMin`, `priceMax`, `verified`, `minRating`, `sort`.
 */
import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  FilterGroup,
  FilterCheckbox,
} from "@/components/directory/filter-rail";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FacetOption } from "@/lib/public-data";

export type FilterDimension =
  | "treatment"
  | "condition"
  | "cellSource"
  | "country"
  | "language";

/** List-valued (comma-joined) filter dimensions — `country` is single-valued. */
const LIST_DIMENSIONS: Exclude<FilterDimension, "country">[] = [
  "treatment",
  "condition",
  "cellSource",
  "language",
];

function splitList(value: string | null): string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** Shared URL writer — clears `page` on any filter change. */
function useDirectoryQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const commit = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      next.delete("page");
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { searchParams, commit };
}

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
];

export function DirectorySort() {
  const { searchParams, commit } = useDirectoryQuery();
  const value = searchParams.get("sort") ?? "recommended";
  return (
    <label className="flex items-center gap-2 text-[13px] text-text-secondary">
      <span className="hidden sm:inline">Sort by</span>
      <Select
        value={value}
        onValueChange={(v) =>
          commit((p) => {
            if (v === "recommended") p.delete("sort");
            else p.set("sort", v);
          })
        }
      >
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function CheckboxFacetGroup({
  title,
  param,
  options,
  initialLimit = 6,
}: {
  title: string;
  param: FilterDimension;
  options: FacetOption[];
  initialLimit?: number;
}) {
  const { searchParams, commit } = useDirectoryQuery();
  const [expanded, setExpanded] = React.useState(false);
  const selected = new Set(splitList(searchParams.get(param)));
  if (!options.length) return null;

  const shown = expanded ? options : options.slice(0, initialLimit);

  const toggle = (slug: string) =>
    commit((p) => {
      const set = new Set(splitList(p.get(param)));
      if (set.has(slug)) set.delete(slug);
      else set.add(slug);
      if (set.size) p.set(param, [...set].join(","));
      else p.delete(param);
    });

  return (
    <FilterGroup
      title={title}
      action={
        options.length > initialLimit ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[13px] font-semibold text-text-link transition-colors hover:text-primary"
          >
            {expanded ? "Show less" : `Show all ${options.length}`}
          </button>
        ) : undefined
      }
    >
      {shown.map((o) => (
        <FilterCheckbox
          key={o.slug}
          label={o.label}
          count={o.count}
          checked={selected.has(o.slug)}
          onChange={() => toggle(o.slug)}
        />
      ))}
    </FilterGroup>
  );
}

/** Single-select facet (used for `country`, which `searchClinics` matches singly). */
function SingleFacetGroup({
  title,
  param,
  options,
  initialLimit = 6,
}: {
  title: string;
  param: FilterDimension;
  options: FacetOption[];
  initialLimit?: number;
}) {
  const { searchParams, commit } = useDirectoryQuery();
  const [expanded, setExpanded] = React.useState(false);
  const current = searchParams.get(param);
  if (!options.length) return null;
  const shown = expanded ? options : options.slice(0, initialLimit);

  const select = (value: string) =>
    commit((p) => {
      if (p.get(param) === value) p.delete(param);
      else p.set(param, value);
    });

  return (
    <FilterGroup
      title={title}
      action={
        options.length > initialLimit ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[13px] font-semibold text-text-link transition-colors hover:text-primary"
          >
            {expanded ? "Show less" : `Show all ${options.length}`}
          </button>
        ) : undefined
      }
    >
      {shown.map((o) => (
        <FilterCheckbox
          key={o.value}
          label={o.label}
          count={o.count}
          checked={current === o.value}
          onChange={() => select(o.value)}
        />
      ))}
    </FilterGroup>
  );
}

function PriceGroup() {
  const { searchParams, commit } = useDirectoryQuery();
  const [min, setMin] = React.useState(searchParams.get("priceMin") ?? "");
  const [max, setMax] = React.useState(searchParams.get("priceMax") ?? "");

  React.useEffect(() => {
    setMin(searchParams.get("priceMin") ?? "");
    setMax(searchParams.get("priceMax") ?? "");
  }, [searchParams]);

  const apply = () =>
    commit((p) => {
      if (min.trim()) p.set("priceMin", String(Number(min)));
      else p.delete("priceMin");
      if (max.trim()) p.set("priceMax", String(Number(max)));
      else p.delete("priceMax");
    });

  return (
    <FilterGroup title="Price range (USD)">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="Min"
          aria-label="Minimum price"
          className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm placeholder:text-text-muted focus-visible:border-primary focus-visible:outline-none"
        />
        <span className="text-text-muted">–</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="Max"
          aria-label="Maximum price"
          className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm placeholder:text-text-muted focus-visible:border-primary focus-visible:outline-none"
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2 w-full"
        onClick={apply}
      >
        Apply price
      </Button>
    </FilterGroup>
  );
}

function VerifiedGroup() {
  const { searchParams, commit } = useDirectoryQuery();
  const checked = searchParams.get("verified") === "1";
  return (
    <FilterGroup title="Verification">
      <FilterCheckbox
        label="Verified clinics only"
        checked={checked}
        onChange={() =>
          commit((p) => {
            if (checked) p.delete("verified");
            else p.set("verified", "1");
          })
        }
      />
    </FilterGroup>
  );
}

function MinRatingGroup() {
  const { searchParams, commit } = useDirectoryQuery();
  const current = searchParams.get("minRating");
  const options = [
    { label: "4.5+", value: "4.5" },
    { label: "4.0+", value: "4" },
    { label: "Any", value: "" },
  ];
  return (
    <FilterGroup title="Minimum rating">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = (current ?? "") === o.value;
          return (
            <Chip
              key={o.label}
              size="sm"
              selected={active}
              onClick={() =>
                commit((p) => {
                  if (o.value) p.set("minRating", o.value);
                  else p.delete("minRating");
                })
              }
            >
              {o.label}
            </Chip>
          );
        })}
      </div>
    </FilterGroup>
  );
}

export interface DirectoryFiltersProps {
  facets: {
    treatments: FacetOption[];
    conditions: FacetOption[];
    cellSources: FacetOption[];
    countries: FacetOption[];
    languages: FacetOption[];
  };
  /** Dimensions pinned by the route (e.g. /treatments/[slug]) — hidden here. */
  locked?: FilterDimension[];
}

export function DirectoryFilters({ facets, locked = [] }: DirectoryFiltersProps) {
  const hidden = new Set(locked);
  return (
    <>
      {!hidden.has("treatment") ? (
        <CheckboxFacetGroup
          title="Treatment type"
          param="treatment"
          options={facets.treatments}
        />
      ) : null}
      {!hidden.has("condition") ? (
        <CheckboxFacetGroup
          title="Condition"
          param="condition"
          options={facets.conditions}
        />
      ) : null}
      {!hidden.has("cellSource") ? (
        <CheckboxFacetGroup
          title="Cell source"
          param="cellSource"
          options={facets.cellSources}
        />
      ) : null}
      {!hidden.has("country") ? (
        <SingleFacetGroup
          title="Location"
          param="country"
          options={facets.countries}
        />
      ) : null}
      <PriceGroup />
      <VerifiedGroup />
      <MinRatingGroup />
      {!hidden.has("language") ? (
        <CheckboxFacetGroup
          title="Languages"
          param="language"
          options={facets.languages}
        />
      ) : null}
    </>
  );
}

// ── Active filter chips + Clear all ──────────────────────────────────────────

export function ActiveFilters({
  labels,
  basePath,
}: {
  /** slug → display label for the list-param dimensions. */
  labels: Record<string, string>;
  basePath: string;
}) {
  const router = useRouter();
  const { searchParams, commit } = useDirectoryQuery();

  const chips: { key: string; label: string; remove: () => void }[] = [];

  for (const dim of LIST_DIMENSIONS) {
    for (const slug of splitList(searchParams.get(dim))) {
      chips.push({
        key: `${dim}:${slug}`,
        label: labels[slug] ?? slug,
        remove: () =>
          commit((p) => {
            const set = new Set(splitList(p.get(dim)));
            set.delete(slug);
            if (set.size) p.set(dim, [...set].join(","));
            else p.delete(dim);
          }),
      });
    }
  }

  const country = searchParams.get("country");
  if (country)
    chips.push({
      key: "country",
      label: country,
      remove: () => commit((p) => p.delete("country")),
    });
  const city = searchParams.get("city");
  if (city)
    chips.push({
      key: "city",
      label: city,
      remove: () => commit((p) => p.delete("city")),
    });

  const q = searchParams.get("q");
  if (q)
    chips.push({
      key: "q",
      label: `“${q}”`,
      remove: () => commit((p) => p.delete("q")),
    });

  if (searchParams.get("verified") === "1")
    chips.push({
      key: "verified",
      label: "Verified only",
      remove: () => commit((p) => p.delete("verified")),
    });

  const minRating = searchParams.get("minRating");
  if (minRating)
    chips.push({
      key: "minRating",
      label: `${minRating}+ rating`,
      remove: () => commit((p) => p.delete("minRating")),
    });

  const priceMin = searchParams.get("priceMin");
  const priceMax = searchParams.get("priceMax");
  if (priceMin || priceMax)
    chips.push({
      key: "price",
      label: `Price ${priceMin ? `$${priceMin}` : "$0"}–${priceMax ? `$${priceMax}` : "any"}`,
      remove: () =>
        commit((p) => {
          p.delete("priceMin");
          p.delete("priceMax");
        }),
    });

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Chip key={c.key} selected onRemove={c.remove} removeLabel={`Remove ${c.label}`}>
          {c.label}
        </Chip>
      ))}
      <button
        type="button"
        onClick={() => router.push(basePath, { scroll: false })}
        className="text-[13px] font-semibold text-text-link transition-colors hover:text-primary"
      >
        Clear all
      </button>
    </div>
  );
}
