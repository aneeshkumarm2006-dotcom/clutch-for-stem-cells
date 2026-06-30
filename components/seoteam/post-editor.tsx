"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/form-field";
import { RichTextEditor } from "@/components/seoteam/rich-text-editor";
import { ImageField, type ImageValue } from "@/components/seoteam/image-field";
import {
  KeywordManager,
  type KeywordEntry,
} from "@/components/seoteam/keyword-manager";
import { SeoCheckPanel } from "@/components/seoteam/seo-check-panel";
import { adminFetch } from "@/lib/admin/client";
import { slugify } from "@/lib/slug";
import { META_DESC_RANGE, META_TITLE_RANGE } from "@/lib/seoteam/seo-checks";
import type { BlogPostStatus, BlogTemplateKey } from "@/lib/enums";

export interface EditorValues {
  title: string;
  slug: string;
  template: BlogTemplateKey;
  excerpt: string;
  metaTitle: string;
  coverImage?: ImageValue;
  keywords: KeywordEntry[];
  linkFirstOnly: boolean;
  author: string;
  body: string;
  status: BlogPostStatus;
}

function CharCount({ len, min, max }: { len: number; min: number; max: number }) {
  const status = len === 0 ? "muted" : len >= min && len <= max ? "ok" : "warn";
  return (
    <span
      className={cn(
        "text-[12px]",
        status === "ok" && "text-success",
        status === "warn" && "text-warning",
        status === "muted" && "text-text-muted",
      )}
    >
      {len} chars · ideal {min}–{max}
    </span>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 font-display text-sm font-semibold text-text-primary">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type SlugStatus = "idle" | "checking" | "available" | "taken";

export function PostEditor({
  mode,
  postId,
  initial,
}: {
  mode: "create" | "edit";
  postId?: string;
  initial: EditorValues;
}) {
  const router = useRouter();
  const [v, setV] = React.useState<EditorValues>(initial);
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  const [slugStatus, setSlugStatus] = React.useState<SlugStatus>("idle");
  const [saving, setSaving] = React.useState(false);

  const set = (patch: Partial<EditorValues>) =>
    setV((cur) => ({ ...cur, ...patch }));

  const onTitle = (title: string) =>
    set({ title, slug: slugTouched ? v.slug : slugify(title) });

  // Debounced slug availability check.
  React.useEffect(() => {
    const slug = v.slug.trim();
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await adminFetch<{ available: boolean }>(
          `/api/seoteam/posts/check-slug?slug=${encodeURIComponent(slug)}${
            postId ? `&id=${postId}` : ""
          }`,
          { signal: ctrl.signal },
        );
        setSlugStatus(res.available ? "available" : "taken");
      } catch {
        // Aborts are expected (newer keystroke); a real failure should clear
        // the spinner rather than hang on "Checking…".
        if (!ctrl.signal.aborted) setSlugStatus("idle");
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [v.slug, postId]);

  const save = async (status: BlogPostStatus) => {
    if (!v.title.trim() || !v.slug.trim()) {
      toast.error("Title and slug are required.");
      return;
    }
    const payload = {
      title: v.title.trim(),
      slug: v.slug.trim(),
      template: v.template,
      status,
      excerpt: v.excerpt.trim() || undefined,
      metaTitle: v.metaTitle.trim() || undefined,
      coverImage: v.coverImage?.url ? v.coverImage : null,
      keywords: v.keywords
        .map((k) => ({
          keyword: k.keyword.trim(),
          url: k.url.trim(),
          rel: k.rel,
        }))
        .filter((k) => k.keyword && k.url),
      linkFirstOnly: v.linkFirstOnly,
      author: v.author.trim() || undefined,
      body: v.body,
    };

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await adminFetch<{ id: string }>("/api/seoteam/posts", {
          method: "POST",
          body: payload,
        });
        set({ status });
        toast.success(status === "published" ? "Published" : "Draft saved");
        router.push(`/seoteam/${res.id}`);
        router.refresh();
      } else {
        await adminFetch(`/api/seoteam/posts/${postId}`, {
          method: "PATCH",
          body: payload,
        });
        set({ status });
        toast.success(
          status === "published"
            ? "Published — live on your blog"
            : "Changes saved",
        );
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Action bar (below the dashboard header) */}
      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/seoteam"
            className="hidden text-[13px] text-text-muted hover:text-text-secondary sm:inline"
          >
            Posts /
          </Link>
          <h1 className="truncate font-display text-base font-bold text-text-primary lg:text-lg">
            {mode === "create" ? "New post" : v.title || "Post"}
          </h1>
          <Badge variant={v.status === "published" ? "success" : "neutral"}>
            {v.status === "published" ? "Published" : "Draft"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && v.status === "published" ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/blog/${v.slug}`} target="_blank">
                <Eye className="size-4" />
                <span className="hidden sm:inline">Preview</span>
              </Link>
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() => save("draft")}
          >
            Save draft
          </Button>
          <Button size="sm" disabled={saving} onClick={() => save("published")}>
            {saving ? "Saving…" : v.status === "published" ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 p-4 lg:flex-row lg:p-6">
        {/* Main column */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <ImageField
              value={v.coverImage}
              onChange={(coverImage) => set({ coverImage })}
            />
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <input
              value={v.title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder="Post title"
              aria-label="Post title"
              className="mb-3 w-full border-none bg-transparent font-display text-2xl font-bold tracking-[-0.02em] text-text-primary outline-none placeholder:text-text-muted"
            />

            <div className="mb-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="post-slug">URL slug</Label>
                {slugStatus === "checking" ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-text-muted">
                    <Loader2 className="size-3 animate-spin" /> Checking…
                  </span>
                ) : slugStatus === "available" ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-success">
                    <Check className="size-3" /> Available
                  </span>
                ) : slugStatus === "taken" ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-danger">
                    <X className="size-3" /> Already taken
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-text-muted">/blog/</span>
                <Input
                  id="post-slug"
                  value={v.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: slugify(e.target.value) });
                  }}
                  placeholder="post-url-slug"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="post-excerpt">Excerpt / meta description</Label>
                <CharCount
                  len={v.excerpt.length}
                  min={META_DESC_RANGE.min}
                  max={META_DESC_RANGE.max}
                />
              </div>
              <Textarea
                id="post-excerpt"
                rows={2}
                value={v.excerpt}
                onChange={(e) => set({ excerpt: e.target.value })}
                placeholder="One-sentence summary shown in search results and post cards."
              />
            </div>

            <div className="mt-4 space-y-1.5">
              <Label>Content</Label>
              <RichTextEditor
                value={v.body}
                onChange={(body) => set({ body })}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full flex-none space-y-4 lg:w-80">
          <Panel title="SEO checks">
            <SeoCheckPanel
              input={{
                title: v.title,
                metaTitle: v.metaTitle,
                excerpt: v.excerpt,
                body: v.body,
                keywords: v.keywords,
                coverImage: v.coverImage,
              }}
            />
          </Panel>

          <Panel title="Search appearance">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="meta-title">Meta title</Label>
                <CharCount
                  len={(v.metaTitle || v.title).length}
                  min={META_TITLE_RANGE.min}
                  max={META_TITLE_RANGE.max}
                />
              </div>
              <Input
                id="meta-title"
                value={v.metaTitle}
                onChange={(e) => set({ metaTitle: e.target.value })}
                placeholder={v.title || "Defaults to the post title"}
              />
            </div>
          </Panel>

          <Panel title="Keyword backlinks">
            <KeywordManager
              value={v.keywords}
              onChange={(keywords) => set({ keywords })}
              linkFirstOnly={v.linkFirstOnly}
              onLinkFirstOnlyChange={(linkFirstOnly) => set({ linkFirstOnly })}
            />
          </Panel>

          <Panel title="Author">
            <Input
              value={v.author}
              onChange={(e) => set({ author: e.target.value })}
              placeholder="Author name (optional)"
              aria-label="Author"
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
