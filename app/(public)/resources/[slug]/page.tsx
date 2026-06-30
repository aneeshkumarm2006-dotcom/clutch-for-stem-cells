import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, Clock } from "lucide-react";

import { articleJsonLd, renderJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/page-metadata";
import {
  getArticleBySlug,
  getPublishedArticleSlugs,
  titleizeSlug,
} from "@/lib/public-data";
import { renderMarkdown } from "@/lib/markdown";
import { Breadcrumbs, type Crumb } from "@/components/common/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { getInitials } from "@/lib/format";

export const revalidate = 600;

export async function generateStaticParams() {
  // Best-effort: fall back to on-demand rendering if the DB is unavailable at
  // build time rather than failing the build (dynamicParams defaults true).
  try {
    const slugs = await getPublishedArticleSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return pageMetadata({ title: "Article not found" });
  return pageMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/resources/${article.slug}`,
    image: article.coverUrl,
    type: "article",
    seo: article.raw.seo ?? null,
  });
}

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  const date = formatDate(article.publishedAt);
  const bodyHtml = article.body ? renderMarkdown(article.body) : "";

  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Resources", href: "/resources" },
    ...(article.category
      ? [
          {
            name: titleizeSlug(article.category),
            href: `/resources/category/${article.category}`,
          },
        ]
      : []),
    { name: article.title, href: `/resources/${article.slug}` },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderJsonLd(articleJsonLd(article.raw)) }}
      />

      <article className="container max-w-3xl py-10 md:py-14">
        <Breadcrumbs items={crumbs} className="mb-5" />

        <header>
          {article.category ? (
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-azure-700">
              {titleizeSlug(article.category)}
            </p>
          ) : null}
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[36px]">
            {article.title}
          </h1>
          {article.excerpt ? (
            <p className="mt-3 text-[17px] leading-relaxed text-text-secondary">
              {article.excerpt}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-text-muted">
            {article.authorName ? (
              <span className="inline-flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-tint font-display text-[11px] font-bold text-azure-700">
                  {getInitials(article.authorName)}
                </span>
                {article.authorName}
              </span>
            ) : null}
            {date ? <span>{date}</span> : null}
            {article.readingTime ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {article.readingTime} min read
              </span>
            ) : null}
          </div>
        </header>

        {article.coverUrl ? (
          <div className="relative mt-6 aspect-[16/8] overflow-hidden rounded-xl border border-border bg-tint">
            <Image
              src={article.coverUrl}
              alt={article.coverAlt ?? article.title}
              fill
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : null}

        {bodyHtml ? (
          <div
            className="prose-article mt-8"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : null}

        {/* Related taxonomy */}
        {article.relatedTreatments.length || article.relatedConditions.length ? (
          <div className="mt-10 border-t border-border pt-6">
            {article.relatedTreatments.length ? (
              <div className="mb-4">
                <p className="text-[13px] font-semibold text-text-primary">
                  Related treatments
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {article.relatedTreatments.map((t) => (
                    <Link key={t.id} href={`/treatments/${t.slug}`}>
                      <Chip className="hover:border-border-strong">{t.name}</Chip>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {article.relatedConditions.length ? (
              <div>
                <p className="text-[13px] font-semibold text-text-primary">
                  Related conditions
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {article.relatedConditions.map((c) => (
                    <Link key={c.id} href={`/conditions/${c.slug}`}>
                      <Chip className="hover:border-border-strong">{c.name}</Chip>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Consultation band */}
        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-br from-azure-700 to-azure-600 p-7 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Researching treatment options?
            </h2>
            <p className="mt-1 text-[14px] text-white/85">
              Compare accredited clinics or get matched to ones that fit your
              needs.
            </p>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link href="/find-a-clinic">
              Find a clinic
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <p className="mt-6 text-[12.5px] leading-relaxed text-text-muted">
          This article is for general information only and is not medical advice.
          Always consult a licensed physician. Individual results vary and no
          outcome is guaranteed.
        </p>
      </article>
    </>
  );
}
