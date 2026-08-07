import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { getPublishedBlogPosts } from "@/lib/seoteam/blog-data";
import { BlogCard } from "@/components/blog/blog-card";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageLead } from "@/components/common/page-lead";
import { getPageContent } from "@/lib/page-content";

export const revalidate = 60;

function pageNumber(
  searchParams: Record<string, string | string[] | undefined>,
): number {
  return (
    Number(
      Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page,
    ) || 1
  );
}

export function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const page = pageNumber(searchParams);
  // Each paginated index page self-canonicalizes (don't fold page 2+ into /blog).
  return pageMetadata({
    // Page 1 takes its title/description from the static-page registry (and any
    // /admin/seo override); a deeper page keeps its own paginated title.
    title: page > 1 ? `Blog | Page ${page}` : undefined,
    path: page > 1 ? `/blog?page=${page}` : "/blog",
  });
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const page = pageNumber(searchParams);
  const [data, content] = await Promise.all([
    getPublishedBlogPosts({ page }),
    getPageContent("/blog"),
  ]);

  return (
    <div className="container py-10 md:py-14">
      {/* Matches the other index pages (and the trail /blog/[slug] links back
          through), and emits the BreadcrumbList JSON-LD with it. */}
      <Breadcrumbs
        className="mb-4"
        items={[
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
        ]}
      />
      <header className="max-w-2xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          {content.title}
        </h1>
        <PageLead html={content.lead} className="mt-2" />
      </header>

      {data.posts.length ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {data.posts.map((post, i) => (
            // The first row is above the fold; its cover is the LCP element.
            <BlogCard key={post.slug} post={post} priority={i < 3} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-10"
          icon={BookOpen}
          title={content.extra("emptyTitle")}
          description={content.extra("emptyDescription")}
        />
      )}

      {data.pageCount > 1 ? (
        <Pagination
          className="mt-10"
          page={data.page}
          totalPages={data.pageCount}
          hrefFor={(p) => (p > 1 ? `/blog?page=${p}` : "/blog")}
        />
      ) : null}

      <BlockRenderer
        blocks={content.blocks}
        className="mt-14 max-w-3xl border-t border-border pt-10"
      />
    </div>
  );
}
