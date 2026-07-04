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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="font-display text-2xl font-bold tabular-nums text-text-primary">
        {value}
      </div>
      <div className="mt-0.5 text-[13px] text-text-muted">{label}</div>
    </div>
  );
}

export default async function SeoTeamDashboard() {
  const posts = await getAdminBlogPosts();

  const publishedLive = posts.filter(
    (p) => p.status === "published" && !p.scheduled,
  ).length;
  const scheduled = posts.filter((p) => p.scheduled).length;
  const drafts = posts.filter((p) => p.status === "draft").length;

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

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Published (live)" value={publishedLive} />
        <StatCard label="Scheduled" value={scheduled} />
        <StatCard label="Drafts" value={drafts} />
      </div>

      <PostsTable initialPosts={posts} />
    </div>
  );
}
