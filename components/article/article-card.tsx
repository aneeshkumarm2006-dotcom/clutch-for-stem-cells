import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { titleizeSlug, type ArticleCardView } from "@/lib/public-data";

/** Format an ISO date as a short readable date ("Jun 14, 2026"). */
function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * ArticleCard — education-hub teaser (PRD §6.7). Cover image (or tint
 * placeholder), category eyebrow, title, excerpt, and reading-time/date meta.
 */
export function ArticleCard({
  article,
  className,
}: {
  article: ArticleCardView;
  className?: string;
}) {
  const date = formatDate(article.publishedAt);
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-azure-200 hover:shadow-md",
        className,
      )}
    >
      <Link href={`/resources/${article.slug}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-tint">
          {article.coverUrl ? (
            <Image
              src={article.coverUrl}
              alt={article.coverAlt ?? ""}
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover"
            />
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {article.category ? (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-azure-700">
            {titleizeSlug(article.category)}
          </p>
        ) : null}
        <h3 className="font-display text-[17px] font-semibold leading-snug text-text-primary">
          <Link
            href={`/resources/${article.slug}`}
            className="transition-colors hover:text-primary"
          >
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-secondary">
            {article.excerpt}
          </p>
        ) : null}
        <div className="mt-4 flex items-center gap-3 text-[12.5px] text-text-muted">
          {date ? <span>{date}</span> : null}
          {article.readingTime ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {article.readingTime} min read
            </span>
          ) : null}
          <ArrowRight
            className="ml-auto size-4 text-text-muted transition-colors group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
      </div>
    </article>
  );
}
