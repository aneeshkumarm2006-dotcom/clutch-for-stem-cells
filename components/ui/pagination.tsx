import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Pagination — Design §10.11. Numbered, **crawlable** `<Link>`s (SEO): the
 * current page is `azure-600` + white; others `text-secondary` with an
 * `azure-50` hover. Prev/Next use chevrons and become inert at the ends.
 *
 * `hrefFor(page)` lets the caller keep all other query params intact (the
 * directory keeps filter state in the URL — TODO 5.2).
 */
type PageToken = number | "ellipsis";

/** 1 … current±1 … last, with ellipses. Always includes first & last. */
export function getPaginationRange(
  page: number,
  totalPages: number,
  siblingCount = 1,
): PageToken[] {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), total);

  // Show every page when the gaps would be small.
  const totalNumbers = siblingCount * 2 + 5;
  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const left = Math.max(current - siblingCount, 1);
  const right = Math.min(current + siblingCount, total);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < total - 1;

  const tokens: PageToken[] = [1];
  if (showLeftEllipsis) tokens.push("ellipsis");
  for (
    let p = showLeftEllipsis ? left : 2;
    p <= (showRightEllipsis ? right : total - 1);
    p++
  ) {
    tokens.push(p);
  }
  if (showRightEllipsis) tokens.push("ellipsis");
  tokens.push(total);
  return tokens;
}

const CELL =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-sm px-2 text-sm transition-colors";

export interface PaginationProps {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  siblingCount?: number;
  className?: string;
  /** Accessible label for the nav landmark. */
  label?: string;
}

export function Pagination({
  page,
  totalPages,
  hrefFor,
  siblingCount = 1,
  className,
  label = "Pagination",
}: PaginationProps) {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), total);
  if (total <= 1) return null;

  const tokens = getPaginationRange(current, total, siblingCount);

  return (
    <nav
      aria-label={label}
      className={cn("flex items-center justify-center gap-1.5", className)}
    >
      {current > 1 ? (
        <Link
          href={hrefFor(current - 1)}
          rel="prev"
          aria-label="Previous page"
          className={cn(CELL, "text-text-secondary hover:bg-azure-50")}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className={cn(CELL, "cursor-default text-text-muted")}
        >
          <ChevronLeft className="size-4" />
        </span>
      )}

      {tokens.map((token, i) =>
        token === "ellipsis" ? (
          <span
            key={`e${i}`}
            aria-hidden="true"
            className="px-1 text-sm text-text-muted"
          >
            …
          </span>
        ) : token === current ? (
          <span
            key={token}
            aria-current="page"
            className={cn(
              CELL,
              "bg-primary font-semibold text-primary-foreground",
            )}
          >
            {token}
          </span>
        ) : (
          <Link
            key={token}
            href={hrefFor(token)}
            aria-label={`Page ${token}`}
            className={cn(CELL, "text-text-secondary hover:bg-azure-50")}
          >
            {token}
          </Link>
        ),
      )}

      {current < total ? (
        <Link
          href={hrefFor(current + 1)}
          rel="next"
          aria-label="Next page"
          className={cn(CELL, "text-text-secondary hover:bg-azure-50")}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className={cn(CELL, "cursor-default text-text-muted")}
        >
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
