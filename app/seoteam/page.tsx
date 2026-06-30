import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { getAdminBlogPosts } from "@/lib/seoteam/blog-data";
import { Button } from "@/components/ui/button";
import { PostsTable } from "@/components/seoteam/posts-table";

export const metadata: Metadata = {
  title: "Posts · SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SeoTeamDashboard() {
  const posts = await getAdminBlogPosts();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">
            Posts
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {posts.length} post{posts.length === 1 ? "" : "s"} · publish and manage
            your blog.
          </p>
        </div>
        <Button asChild>
          <Link href="/seoteam/new">
            <PlusCircle className="size-4" />
            New post
          </Link>
        </Button>
      </div>

      <PostsTable initialPosts={posts} />
    </div>
  );
}
