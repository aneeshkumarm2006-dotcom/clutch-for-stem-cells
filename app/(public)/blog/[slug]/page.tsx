import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { blogPostingJsonLd, renderJsonLd } from "@/lib/seo";
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
              reviewer: post.reviewer,
              lastReviewed: post.lastReviewedAt,
            }),
          ),
        }}
      />
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
