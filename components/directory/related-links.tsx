import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface RelatedLink {
  href: string;
  label: string;
  /** Optional muted suffix, e.g. "5 clinics". */
  meta?: string;
}

export interface RelatedLinkGroup {
  title: string;
  /** Optional one-line, neutrally-worded framing for the group. */
  description?: string;
  links: RelatedLink[];
}

/** "5 clinics" / "1 clinic" suffix for a related-link `meta`, or undefined at 0. */
export function clinicCountMeta(count?: number): string | undefined {
  if (!count) return undefined;
  return `${count} clinic${count === 1 ? "" : "s"}`;
}

/**
 * Hub-and-spoke internal linking for taxonomy + combination pages — surfaces
 * sibling terms, co-occurring treatments/conditions, and destination links so
 * no page is orphaned and link equity flows across the matrix. Presentational
 * only; the caller supplies already-resolved groups. Renders nothing when every
 * group is empty (so a sparse page doesn't show empty headings).
 *
 * YMYL note: group descriptions must stay neutral (e.g. "Clinics offering X
 * also list these conditions") — never assert that a therapy treats/cures a
 * condition. Wording is the caller's responsibility.
 */
export function RelatedLinks({
  groups,
  className,
}: {
  groups: RelatedLinkGroup[];
  className?: string;
}) {
  const visible = groups.filter((g) => g.links.length > 0);
  if (!visible.length) return null;

  return (
    <nav
      aria-label="Related pages"
      className={cn(
        "grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {visible.map((group) => (
        <div key={group.title}>
          <h2 className="font-display text-[15px] font-semibold text-text-primary">
            {group.title}
          </h2>
          {group.description ? (
            <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
              {group.description}
            </p>
          ) : null}
          <ul className="mt-3 space-y-1.5">
            {group.links.map((link) => (
              <li key={link.href} className="text-[14px] leading-snug">
                <Link
                  href={link.href}
                  className="text-text-link hover:underline"
                >
                  {link.label}
                </Link>
                {link.meta ? (
                  <span className="ml-1.5 text-[12px] text-text-muted">
                    {link.meta}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
