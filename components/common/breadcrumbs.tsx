import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { breadcrumbListJsonLd, renderJsonLd } from "@/lib/seo";

export interface Crumb {
  name: string;
  /** Root-relative path or absolute URL. */
  href: string;
}

/**
 * Breadcrumbs — the single source for crawlable breadcrumb trails (Stage 7.5).
 * Renders the Azure Clinical breadcrumb UI **and** emits matching
 * `BreadcrumbList` JSON-LD (Stage 7.3), so directory, profile, and article pages
 * stay consistent. The last crumb is the current page (not linked).
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: renderJsonLd(
            breadcrumbListJsonLd(
              items.map((i) => ({ name: i.name, path: i.href })),
            ),
          ),
        }}
      />
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex flex-wrap items-center gap-1 text-[13px] text-text-muted">
          {items.map((b, i) => {
            const isLast = i === items.length - 1;
            return (
              <li key={b.href} className="flex items-center gap-1">
                {i > 0 ? (
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                ) : null}
                {isLast ? (
                  <span className="text-text-secondary" aria-current="page">
                    {b.name}
                  </span>
                ) : (
                  <Link
                    href={b.href}
                    className="transition-colors hover:text-text-secondary"
                  >
                    {b.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
