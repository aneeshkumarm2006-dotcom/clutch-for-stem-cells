import * as React from "react";
import { RemoteImage } from "@/components/common/remote-image";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import {
  ReviewedByByline,
  type ReviewerByline,
} from "@/components/content/reviewed-by-byline";

export interface BlogArticleProps {
  title: string;
  excerpt?: string;
  author?: string;
  /** Pre-formatted, locale-safe date string (callers format to avoid hydration). */
  dateLabel?: string;
  readingTime?: number;
  coverUrl?: string;
  coverAlt?: string;
  /** Sanitized (+ keyword-linked) HTML — rendered via dangerouslySetInnerHTML. */
  bodyHtml: string;
  /** Credentialed medical reviewer — renders nothing when null/undefined. */
  reviewer?: ReviewerByline | null;
  /** ISO date/Date the post was last medically reviewed. */
  lastReviewedAt?: Date | string | null;
  /** ISO date/Date the post was last modified (for the "Updated" byline). */
  updatedAt?: Date | string | null;
  /** Slot above the header (e.g. breadcrumbs on the public page). */
  topSlot?: React.ReactNode;
  className?: string;
}

/**
 * Shared blog article layout — header + cover + body + disclaimer. Pure and
 * client-safe (no server-only imports, no JSON-LD, no view tracking) so it can
 * render in the public post page (server), the /seoteam preview route (server),
 * AND the in-editor Preview tab (client). Body typography comes from `.prose-blog`
 * (globals.css), the same class used by the editor surface.
 */
export function BlogArticle({
  title,
  excerpt,
  author,
  dateLabel,
  readingTime,
  coverUrl,
  coverAlt,
  bodyHtml,
  reviewer,
  lastReviewedAt,
  updatedAt,
  topSlot,
  className,
}: BlogArticleProps) {
  return (
    <article className={cn("container max-w-3xl py-10 md:py-14", className)}>
      {topSlot}

      <header>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[36px]">
          {title || "Untitled post"}
        </h1>
        {excerpt ? (
          <p className="mt-3 text-[17px] leading-relaxed text-text-secondary">
            {excerpt}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-text-muted">
          {author ? (
            <span className="inline-flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-tint font-display text-[11px] font-bold text-azure-700">
                {getInitials(author)}
              </span>
              {author}
            </span>
          ) : null}
          {dateLabel ? <span>{dateLabel}</span> : null}
          {readingTime ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {readingTime} min read
            </span>
          ) : null}
        </div>
        <ReviewedByByline
          reviewer={reviewer}
          lastReviewedAt={lastReviewedAt}
          updatedAt={updatedAt}
          className="mt-3"
        />
      </header>

      {coverUrl ? (
        <div className="relative mt-6 aspect-[16/8] overflow-hidden rounded-xl border border-border bg-tint">
          <RemoteImage
            src={coverUrl}
            alt={coverAlt ?? title}
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      ) : null}

      {bodyHtml ? (
        <div
          className="prose-blog mt-8"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : null}

      <p className="mt-10 border-t border-border pt-6 text-[12.5px] leading-relaxed text-text-muted">
        This article is for general information only and is not medical advice.
        Always consult a licensed physician. Individual results vary and no
        outcome is guaranteed.
      </p>
    </article>
  );
}
