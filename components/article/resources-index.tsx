import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ArticleCard } from "@/components/article/article-card";
import { titleizeSlug, type ArticlesPage } from "@/lib/public-data";

/**
 * ResourcesIndex — education-hub listing (PRD §6.7). Featured article (index
 * only), category filter chips, article grid, and crawlable pagination. Shared
 * by `/resources` and `/resources/category/[slug]`.
 */
export function ResourcesIndex({
  data,
  activeCategory,
  title,
  intro,
  basePath,
}: {
  data: ArticlesPage;
  activeCategory?: string;
  title: string;
  intro: string;
  basePath: string;
}) {
  return (
    <div className="container py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          {title}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
          {intro}
        </p>
      </header>

      {/* Category filter */}
      {data.categories.length ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <CategoryPill href="/resources" active={!activeCategory} label="All" />
          {data.categories.map((c) => (
            <CategoryPill
              key={c.slug}
              href={`/resources/category/${c.slug}`}
              active={activeCategory === c.slug}
              label={`${c.label} (${c.count})`}
            />
          ))}
        </div>
      ) : null}

      {/* Featured */}
      {data.featured ? (
        <Link
          href={`/resources/${data.featured.slug}`}
          className="group mt-8 grid overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-all duration-200 hover:border-azure-200 hover:shadow-md md:grid-cols-2"
        >
          <div className="relative aspect-[16/10] bg-tint md:aspect-auto">
            {data.featured.coverUrl ? (
              <Image
                src={data.featured.coverUrl}
                alt={data.featured.coverAlt ?? ""}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="flex flex-col justify-center p-6 md:p-8">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-azure-700">
              Featured
            </span>
            <h2 className="mt-2 font-display text-[22px] font-bold leading-tight tracking-[-0.01em] text-text-primary">
              {data.featured.title}
            </h2>
            {data.featured.excerpt ? (
              <p className="mt-2 text-[14.5px] leading-relaxed text-text-secondary">
                {data.featured.excerpt}
              </p>
            ) : null}
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-text-link transition-colors group-hover:text-primary">
              Read article
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </div>
        </Link>
      ) : null}

      {/* Grid */}
      {data.articles.length ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {data.articles
            .filter((a) => a.slug !== data.featured?.slug)
            .map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
        </div>
      ) : (
        <EmptyState
          className="mt-10"
          icon={BookOpen}
          title="No articles yet"
          description={
            activeCategory
              ? `No articles in ${titleizeSlug(activeCategory)} yet. Check back soon.`
              : "Patient guides are on the way. Check back soon."
          }
        />
      )}

      {data.pageCount > 1 ? (
        <Pagination
          className="mt-10"
          page={data.page}
          totalPages={data.pageCount}
          hrefFor={(p) => (p > 1 ? `${basePath}?page=${p}` : basePath)}
        />
      ) : null}
    </div>
  );
}

function CategoryPill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center rounded-sm border px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "border-azure-300 bg-tint text-azure-700"
          : "border-border bg-surface text-text-secondary hover:border-border-strong",
      )}
    >
      {label}
    </Link>
  );
}
