"use client";

/**
 * ReviewsControls — sort + filter for a clinic's reviews (PRD §6.4). State lives
 * in the URL (`revSort`, `revTreatment`, `revCondition`, `revMin`) so it's
 * SSR-rendered and shareable; changing a control scrolls back to the reviews
 * anchor. Pairs with `getClinicReviews` on the profile page.
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

export function ReviewsControls({
  treatments,
  conditions,
}: {
  treatments: { slug: string; name: string }[];
  conditions: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("revPage");
    router.push(`${pathname}?${next.toString()}#reviews`, { scroll: false });
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
  };

  const sort = searchParams.get("revSort") ?? "recent";
  const treatment = searchParams.get("revTreatment") ?? "all";
  const condition = searchParams.get("revCondition") ?? "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {treatments.length ? (
        <Select
          value={treatment}
          onValueChange={(v) => set("revTreatment", v === "all" ? null : v)}
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
          onValueChange={(v) => set("revCondition", v === "all" ? null : v)}
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

      <Select value={sort} onValueChange={(v) => set("revSort", v === "recent" ? null : v)}>
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
