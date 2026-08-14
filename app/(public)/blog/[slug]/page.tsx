import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { buildJsonLd } from "@/lib/schema/engine";
import { getSchemaContext } from "@/lib/schema/context";
import { redirectOrNotFound } from "@/lib/redirects";
import { pageMetadata } from "@/lib/page-metadata";
import {
  getBlogPostBySlug,
  getPublishedBlogSlugs,
} from "@/lib/seoteam/blog-data";
import { applyKeywordLinks } from "@/lib/seoteam/keyword-links";
import { Breadcrumbs, type Crumb } from "@/components/common/breadcrumbs";
import { ViewBeacon } from "@/components/blog/view-beacon";
import { BlogArticle } from "@/components/blog/blog-article";

export const revalidate = 60;

/** Words in the rendered body → `BlogPosting.wordCount`. HTML tags don't count. */
function wordCountOf(html: string): number | undefined {
  const words = html
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return words || undefined;
}

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
    // Per-page overrides (canonical, OG/Twitter, robots) win over the derived
    // values above and over the Settings defaults.
    seo: post.seo,
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
  // A re-slugged post should send its old URL onward rather than 404.
  if (!post) return redirectOrNotFound(`/blog/${params.slug}`);

  const date = formatDate(post.publishedAt);
  const bodyHtml = applyKeywordLinks(post.body, post.keywords, post.linkFirstOnly);

  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Blog", href: "/blog" },
    { name: post.title, href: `/blog/${post.slug}` },
  ];

  const ctx = await getSchemaContext();
  const jsonLd = buildJsonLd(
    "blogPost",
    {
      post: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        coverImageUrl: post.coverUrl,
        author: post.author,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        reviewer: post.reviewer,
        lastReviewed: post.lastReviewedAt,
        // The post's own target terms, not a keyword-stuffed list: these are the
        // phrases the editor already declared for internal linking, so they
        // cannot describe the article as something it is not.
        keywords: post.keywords.map((k) => k.keyword).filter(Boolean),
        wordCount: wordCountOf(post.body),
      },
    },
    ctx,
    post.schemaOverrides ?? null,
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <ViewBeacon slug={post.slug} />

      <BlogArticle
        title={post.title}
        excerpt={post.excerpt}
        author={post.author}
        dateLabel={date}
        readingTime={post.readingTime}
        coverUrl={post.coverUrl}
        coverAlt={post.coverAlt}
        bodyHtml={bodyHtml}
        reviewer={post.reviewer}
        lastReviewedAt={post.lastReviewedAt}
        updatedAt={post.updatedAt}
        topSlot={<Breadcrumbs items={crumbs} className="mb-5" />}
      />
    </>
  );
}
