import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { getPublishedBlogPosts } from "@/lib/seoteam/blog-data";
import { BlogCard } from "@/components/blog/blog-card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { SITE_NAME } from "@/config/site";

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
    title: page > 1 ? `Blog — Page ${page}` : "Blog",
    description: `Guides, updates, and insights from the ${SITE_NAME} team.`,
    path: page > 1 ? `/blog?page=${page}` : "/blog",
  });
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const page = pageNumber(searchParams);
  const data = await getPublishedBlogPosts({ page });

  return (
    <div className="container py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          Blog
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
          Guides, updates, and insights from the {SITE_NAME} team.
        </p>
      </header>

      {data.posts.length ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {data.posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-10"
          icon={BookOpen}
          title="No posts yet"
          description="New articles are on the way. Check back soon."
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
    </div>
  );
}
