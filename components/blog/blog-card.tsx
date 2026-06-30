import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BlogCardView } from "@/lib/seoteam/blog-data";

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Blog index teaser — cover, title, excerpt, date + reading time. */
export function BlogCard({
  post,
  className,
}: {
  post: BlogCardView;
  className?: string;
}) {
  const date = formatDate(post.publishedAt);
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-azure-200 hover:shadow-md",
        className,
      )}
    >
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-tint">
          {post.coverUrl ? (
            <Image
              src={post.coverUrl}
              alt={post.coverAlt ?? ""}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover"
              unoptimized
            />
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[17px] font-semibold leading-snug text-text-primary">
          <Link
            href={`/blog/${post.slug}`}
            className="transition-colors hover:text-primary"
          >
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-secondary">
            {post.excerpt}
          </p>
        ) : null}
        <div className="mt-4 flex items-center gap-3 text-[12.5px] text-text-muted">
          {date ? <span>{date}</span> : null}
          {post.readingTime ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {post.readingTime} min read
            </span>
          ) : null}
          <ArrowRight
            className="ml-auto size-4 text-text-muted transition-colors group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
      </div>
    </article>
  );
}
