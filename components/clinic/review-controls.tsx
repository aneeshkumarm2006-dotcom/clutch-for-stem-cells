"use client";

/**
 * ReviewsControls — sort + filter for a clinic's reviews (PRD §6.4). State lives
 * in the URL so it's SSR-rendered and shareable; changing a control scrolls back
 * to the reviews anchor. Pairs with `getClinicReviews`.
 *
 * The query-key names are injectable because the same control serves two routes:
 * the profile, where reviews are one section among many and the keys are
 * namespaced (`revSort`, …), and the dedicated `/clinic/[slug]/reviews` page,
 * where reviews *are* the page so the plain keys (`sort`, `page`, …) are both
 * cleaner and the ones `shouldNoindexDirectory` already knows to de-index.
 */
import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORTS = [
  { value: "recent", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
  { value: "helpful", label: "Most helpful" },
];

/** URL query keys the control reads and writes. */
export interface ReviewParamKeys {
  sort: string;
  treatment: string;
  condition: string;
  page: string;
}

/** Namespaced keys, so the profile's other sections keep their own params. */
export const PROFILE_REVIEW_PARAMS: ReviewParamKeys = {
  sort: "revSort",
  treatment: "revTreatment",
  condition: "revCondition",
  page: "revPage",
};

/** Plain keys for the dedicated reviews page. */
export const REVIEWS_PAGE_PARAMS: ReviewParamKeys = {
  sort: "sort",
  treatment: "treatment",
  condition: "condition",
  page: "page",
};

export function ReviewsControls({
  treatments,
  conditions,
  keys = PROFILE_REVIEW_PARAMS,
  anchor = "reviews",
}: {
  treatments: { slug: string; name: string }[];
  conditions: { slug: string; name: string }[];
  keys?: ReviewParamKeys;
  anchor?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete(keys.page);
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}#${anchor}`, { scroll: false });
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
  };

  const sort = searchParams.get(keys.sort) ?? "recent";
  const treatment = searchParams.get(keys.treatment) ?? "all";
  const condition = searchParams.get(keys.condition) ?? "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {treatments.length ? (
        <Select
          value={treatment}
          onValueChange={(v) => set(keys.treatment, v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Treatment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All treatments</SelectItem>
            {treatments.map((t) => (
              <SelectItem key={t.slug} value={t.slug}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {conditions.length ? (
        <Select
          value={condition}
          onValueChange={(v) => set(keys.condition, v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All conditions</SelectItem>
            {conditions.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select value={sort} onValueChange={(v) => set(keys.sort, v === "recent" ? null : v)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
