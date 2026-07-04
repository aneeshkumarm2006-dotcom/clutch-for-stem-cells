import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getBlogPostForEdit } from "@/lib/seoteam/blog-data";
import {
  PostEditor,
  type EditorValues,
  type BlogVisibility,
} from "@/components/seoteam/post-editor";

export const metadata: Metadata = {
  title: "Edit post · SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: { id: string };
}) {
  const post = await getBlogPostForEdit(params.id);
  if (!post) notFound();

  // Derive the visibility control server-side (avoids a client `new Date()` at
  // render): draft → Draft; published with a future date → Scheduled; else Visible.
  const isFuture =
    !!post.publishedAt && new Date(post.publishedAt).getTime() > Date.now();
  const visibility: BlogVisibility =
    post.status === "draft" ? "draft" : isFuture ? "scheduled" : "visible";

  const initial: EditorValues = {
    title: post.title,
    slug: post.slug,
    template: post.template,
    excerpt: post.excerpt ?? "",
    metaTitle: post.metaTitle ?? "",
    coverImage: post.coverImage,
    keywords: post.keywords,
    linkFirstOnly: post.linkFirstOnly,
    author: post.author ?? "",
    body: post.body,
    visibility,
    publishedAt: post.publishedAt ?? "",
  };

  return <PostEditor mode="edit" postId={post.id} initial={initial} />;
}
