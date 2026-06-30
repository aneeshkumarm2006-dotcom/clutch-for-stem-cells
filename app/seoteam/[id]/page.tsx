import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getBlogPostForEdit } from "@/lib/seoteam/blog-data";
import { PostEditor, type EditorValues } from "@/components/seoteam/post-editor";

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
    status: post.status,
  };

  return <PostEditor mode="edit" postId={post.id} initial={initial} />;
}
