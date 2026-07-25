import * as React from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import type { RatingBucket } from "@/lib/public-data";

/**
 * RatingHistogram — the 5★→1★ distribution bars on a clinic's reviews page.
 *
 * Server-rendered (plain markup, not a chart library) so the numbers sit in the
 * HTML for crawlers and AI answer engines rather than being painted in after
 * hydration.
 */
export function RatingHistogram({
  distribution,
  className,
}: {
  distribution: RatingBucket[];
  className?: string;
}) {
  return (
    <ul className={cn("space-y-1.5", className)}>
      {distribution.map((bucket) => (
        <li
          key={bucket.stars}
          className="flex items-center gap-2.5"
          aria-label={`${bucket.stars} star: ${formatCount(bucket.count)} reviews, ${bucket.percent}%`}
        >
          <span
            className="flex w-10 shrink-0 items-center gap-0.5 text-[13px] tabular-nums text-text-secondary"
            aria-hidden="true"
          >
            {bucket.stars}
            <Star className="size-3 fill-star text-star" />
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-tint">
            <span
              className="block h-full rounded-full bg-star"
              style={{ width: `${bucket.percent}%` }}
            />
          </span>
          <span
            className="w-[72px] shrink-0 text-right text-[12.5px] tabular-nums text-text-muted"
            aria-hidden="true"
          >
            {formatCount(bucket.count)} ({bucket.percent}%)
          </span>
        </li>
      ))}
    </ul>
  );
}
