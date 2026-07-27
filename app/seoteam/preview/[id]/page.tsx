/**
 * Full-page blog preview — /seoteam/preview/[id].
 *
 * Lives under /seoteam (so the middleware auth gate + `noindex` metadata apply)
 * but OUTSIDE the `(dashboard)` route group, so it renders the REAL public
 * navbar/footer instead of the dashboard chrome — a faithful, themed preview of
 * how the post will look once live. Fetches by id regardless of status/publish
 * date (drafts + scheduled included) and applies the same keyword-link injection
 * as production. JSON-LD and view tracking are intentionally omitted (preview
 * only). Auth is re-checked here in addition to the middleware gate.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, EyeOff } from "lucide-react";

import { isSeoAuthenticated } from "@/lib/seoteam/auth";
import { getBlogPostForPreview } from "@/lib/seoteam/blog-data";
import { applyKeywordLinks } from "@/lib/seoteam/keyword-links";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BlogArticle } from "@/components/blog/blog-article";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPreviewPage({
  params,
}: {
  params: { id: string };
}) {
  // Belt-and-braces auth (middleware already gates /seoteam/*).
  if (!(await isSeoAuthenticated())) {
    redirect(`/seoteam/login?next=/seoteam/preview/${params.id}`);
  }

  const post = await getBlogPostForPreview(params.id);
  if (!post) notFound();

  const bodyHtml = applyKeywordLinks(
    post.body,
    post.keywords,
    post.linkFirstOnly,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Not-published banner */}
      <div className="border-b border-warning/30 bg-warning-bg">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-2.5">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-warning-fg">
            <EyeOff className="size-4" aria-hidden="true" />
            Preview: this post is not published. It won’t appear on your public
            blog until it’s live.
          </span>
          <Link
            href={`/seoteam/${params.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-link hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to editor
          </Link>
        </div>
      </div>

      <main id="main-content" className="flex-1">
        <BlogArticle
          title={post.title}
          excerpt={post.excerpt}
          author={post.author}
          dateLabel={formatDate(post.publishedAt)}
          readingTime={post.readingTime}
          coverUrl={post.coverUrl}
          coverAlt={post.coverAlt}
          bodyHtml={bodyHtml}
          reviewer={post.reviewer}
          lastReviewedAt={post.lastReviewedAt}
          updatedAt={post.updatedAt}
        />
      </main>

      <Footer />
    </div>
  );
}
