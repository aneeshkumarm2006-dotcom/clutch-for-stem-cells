import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { Clock } from "lucide-react";

import { blogPostingJsonLd, renderJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/page-metadata";
import {
  getBlogPostBySlug,
  getPublishedBlogSlugs,
} from "@/lib/seoteam/blog-data";
import { applyKeywordLinks } from "@/lib/seoteam/keyword-links";
import { Breadcrumbs, type Crumb } from "@/components/common/breadcrumbs";
import { ViewBeacon } from "@/components/blog/view-beacon";
import { getInitials } from "@/lib/format";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const slugs = await getPublishedBlogSlugs();
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
  const post = await getBlogPostBySlug(params.slug);
  if (!post) return pageMetadata({ title: "Post not found" });
  return pageMetadata({
    title: post.metaTitle || post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    image: post.coverUrl,
    type: "article",
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

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getBlogPostBySlug(params.slug);
  if (!post) notFound();

  const date = formatDate(post.publishedAt);
  const bodyHtml = applyKeywordLinks(post.body, post.keywords, post.linkFirstOnly);

  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Blog", href: "/blog" },
    { name: post.title, href: `/blog/${post.slug}` },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: renderJsonLd(
            blogPostingJsonLd({
              title: post.title,
              slug: post.slug,
              excerpt: post.excerpt,
              coverImageUrl: post.coverUrl,
              author: post.author,
              publishedAt: post.publishedAt,
              updatedAt: post.updatedAt,
            }),
          ),
        }}
      />
      <ViewBeacon slug={post.slug} />

      <article className="container max-w-3xl py-10 md:py-14">
        <Breadcrumbs items={crumbs} className="mb-5" />

        <header>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[36px]">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="mt-3 text-[17px] leading-relaxed text-text-secondary">
              {post.excerpt}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-text-muted">
            {post.author ? (
              <span className="inline-flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-tint font-display text-[11px] font-bold text-azure-700">
                  {getInitials(post.author)}
                </span>
                {post.author}
              </span>
            ) : null}
            {date ? <span>{date}</span> : null}
            {post.readingTime ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {post.readingTime} min read
              </span>
            ) : null}
          </div>
        </header>

        {post.coverUrl ? (
          <div className="relative mt-6 aspect-[16/8] overflow-hidden rounded-xl border border-border bg-tint">
            <Image
              src={post.coverUrl}
              alt={post.coverAlt ?? post.title}
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
    </>
  );
}
