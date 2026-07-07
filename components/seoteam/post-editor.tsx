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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/seoteam/rich-text-editor";
import { ImageField, type ImageValue } from "@/components/seoteam/image-field";
import { BlogArticle } from "@/components/blog/blog-article";
import {
  KeywordManager,
  type KeywordEntry,
} from "@/components/seoteam/keyword-manager";
import { SeoCheckPanel } from "@/components/seoteam/seo-check-panel";
import {
  editorialSelectClass,
  type ReviewerOption,
} from "@/components/content/editorial-fields";
import { adminFetch } from "@/lib/admin/client";
import { slugify } from "@/lib/slug";
import { estimateReadingTime } from "@/lib/reading-time";
import {
  META_DESC_RANGE,
  META_TITLE_RANGE,
  htmlToText,
} from "@/lib/seoteam/seo-checks";
import type { BlogTemplateKey } from "@/lib/enums";

/** Shopify-style visibility: draft (private), visible (live now), scheduled (future). */
export type BlogVisibility = "draft" | "visible" | "scheduled";

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
  /** Selected medical reviewer id (empty = none). */
  reviewedBy: string;
  /** ISO-8601 date the reviewer signed off (empty = none). */
  lastReviewedAt: string;
  body: string;
  visibility: BlogVisibility;
  /** ISO-8601 string (empty = publish now / no scheduled time). */
  publishedAt: string;
}

// ── Time helpers (client-only; gate any render use behind `mounted`) ──────────

/** ISO string → value for `<input type="datetime-local">` in the viewer's local time. */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** `<input type="datetime-local">` value (local time) → ISO-8601 UTC string. */
function localInputToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function formatDateLabel(iso: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const blankToUndef = (s: string): string | undefined =>
  s && s.trim() ? s : undefined;

const truncate = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

// ── Small presentational helpers ──────────────────────────────────────────────

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

/** Google-style search result preview (mirrors the site's metadata precedence). */
function SearchListingPreview({
  title,
  metaTitle,
  excerpt,
  slug,
  mounted,
}: {
  title: string;
  metaTitle: string;
  excerpt: string;
  slug: string;
  mounted: boolean;
}) {
  const host = mounted ? window.location.host : "yoursite.com";
  const urlSlug = slug || slugify(title) || "post-url-slug";
  const displayTitle = truncate(metaTitle.trim() || title.trim() || "Untitled post", 60);
  const displayDesc = excerpt.trim()
    ? truncate(excerpt.trim(), 160)
    : "Add an excerpt to control how this description reads in search results.";

  return (
    <div className="rounded-md border border-border bg-surface-alt/40 p-3">
      <div className="truncate text-[12px] text-text-muted">
        {host} › blog › {urlSlug}
      </div>
      <div className="mt-0.5 truncate text-[18px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
        {displayTitle}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[13px] leading-snug",
          excerpt.trim() ? "text-text-secondary" : "text-text-muted italic",
        )}
      >
        {displayDesc}
      </div>
    </div>
  );
}

/** Draft / Visible / Scheduled control (Shopify-style). */
function VisibilityCard({
  visibility,
  publishedAt,
  onChange,
  mounted,
}: {
  visibility: BlogVisibility;
  publishedAt: string;
  onChange: (patch: { visibility?: BlogVisibility; publishedAt?: string }) => void;
  mounted: boolean;
}) {
  const options: { key: BlogVisibility; label: string; hint: string }[] = [
    { key: "draft", label: "Draft", hint: "Only you can see it" },
    { key: "visible", label: "Visible", hint: "Live on your blog" },
    { key: "scheduled", label: "Scheduled", hint: "Publishes automatically" },
  ];

  const select = (next: BlogVisibility) => {
    const now = Date.now();
    if (next === "visible") {
      // Publish now, but keep a past date if one exists; clear a FUTURE date.
      const keep =
        publishedAt && new Date(publishedAt).getTime() <= now ? publishedAt : "";
      onChange({ visibility: "visible", publishedAt: keep });
    } else if (next === "scheduled") {
      // Prefill ~1h ahead unless a future date is already set.
      const hasFuture =
        publishedAt && new Date(publishedAt).getTime() > now;
      const next1h = new Date(now + 60 * 60 * 1000).toISOString();
      onChange({
        visibility: "scheduled",
        publishedAt: hasFuture ? publishedAt : next1h,
      });
    } else {
      onChange({ visibility: "draft" });
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => select(o.key)}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
              visibility === o.key
                ? "border-primary bg-tint"
                : "border-border hover:border-border-strong",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-4 flex-none items-center justify-center rounded-full border",
                visibility === o.key
                  ? "border-primary bg-primary"
                  : "border-border-strong",
              )}
            >
              {visibility === o.key ? (
                <Check className="size-3 text-primary-foreground" />
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-text-primary">
                {o.label}
              </span>
              <span className="block text-[12px] text-text-muted">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {visibility === "scheduled" ? (
        <div className="space-y-1.5 rounded-lg border border-border bg-surface-alt/40 p-3">
          <Label htmlFor="publish-at">Publish date &amp; time</Label>
          {mounted ? (
            <>
              <Input
                id="publish-at"
                type="datetime-local"
                value={isoToLocalInput(publishedAt)}
                onChange={(e) =>
                  onChange({ publishedAt: localInputToIso(e.target.value) })
                }
              />
              <p className="text-[12px] text-text-muted">
                {formatDateLabel(publishedAt)
                  ? `Goes live ${formatDateLabel(publishedAt)} (your local time).`
                  : "Pick a future date and time."}
              </p>
            </>
          ) : (
            <div className="h-9 rounded-md border border-border bg-surface" />
          )}
        </div>
      ) : null}
    </div>
  );
}

type SlugStatus = "idle" | "checking" | "available" | "taken";

export function PostEditor({
  mode,
  postId,
  initial,
  reviewers,
}: {
  mode: "create" | "edit";
  postId?: string;
  initial: EditorValues;
  reviewers: ReviewerOption[];
}) {
  const router = useRouter();
  const mounted = useMounted();
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
        if (!ctrl.signal.aborted) setSlugStatus("idle");
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [v.slug, postId]);

  const save = async () => {
    if (!v.title.trim() || !v.slug.trim()) {
      toast.error("Title and slug are required.");
      return;
    }
    const status = v.visibility === "draft" ? "draft" : "published";
    const payload = {
      title: v.title.trim(),
      slug: v.slug.trim(),
      template: v.template,
      status,
      publishedAt: status === "published" ? blankToUndef(v.publishedAt) : undefined,
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
      // `null` clears an existing reviewer; a 24-char id assigns one.
      reviewedBy: v.reviewedBy || null,
      lastReviewedAt: v.reviewedBy ? v.lastReviewedAt || null : null,
      body: v.body,
    };

    const successMsg =
      v.visibility === "draft"
        ? "Draft saved"
        : v.visibility === "scheduled"
          ? "Scheduled — publishes automatically"
          : "Published — live on your blog";

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await adminFetch<{ id: string }>("/api/seoteam/posts", {
          method: "POST",
          body: payload,
        });
        toast.success(successMsg);
        router.push(`/seoteam/${res.id}`);
        router.refresh();
      } else {
        await adminFetch(`/api/seoteam/posts/${postId}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success(successMsg);
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const badge =
    v.visibility === "visible"
      ? { variant: "success" as const, label: "Published" }
      : v.visibility === "scheduled"
        ? { variant: "warning" as const, label: "Scheduled" }
        : { variant: "neutral" as const, label: "Draft" };

  const saveLabel = saving
    ? "Saving…"
    : v.visibility === "draft"
      ? "Save draft"
      : v.visibility === "scheduled"
        ? "Schedule"
        : mode === "edit"
          ? "Update"
          : "Publish";

  // Selected reviewer → byline shape for the live in-editor preview (null = none).
  const selected = v.reviewedBy
    ? reviewers.find((r) => r.id === v.reviewedBy)
    : undefined;
  const previewReviewer = selected
    ? { name: selected.name, credentials: selected.credentials }
    : null;

  // Preview href: live posts → the real page; drafts/scheduled → the full-page preview.
  const previewHref =
    v.visibility === "visible"
      ? `/blog/${v.slug}`
      : postId
        ? `/seoteam/preview/${postId}`
        : null;

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
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && previewHref ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={previewHref} target="_blank">
                <Eye className="size-4" />
                <span className="hidden sm:inline">Preview</span>
              </Link>
            </Button>
          ) : null}
          <Button size="sm" disabled={saving} onClick={save}>
            {saveLabel}
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
              <Tabs defaultValue="edit">
                <TabsList>
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                {/* forceMount keeps the Tiptap instance (+ HTML source textarea)
                    alive when the Preview tab is active. */}
                <TabsContent
                  value="edit"
                  forceMount
                  className="data-[state=inactive]:hidden"
                >
                  <RichTextEditor
                    value={v.body}
                    onChange={(body) => set({ body })}
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="overflow-hidden rounded-lg border border-border bg-surface">
                    <p className="border-b border-border bg-surface-alt/60 px-4 py-2 text-[12px] text-text-muted">
                      Live preview of the post body & header. Keyword backlinks
                      are woven in at publish time and aren’t shown here.
                    </p>
                    <BlogArticle
                      title={v.title}
                      excerpt={v.excerpt || undefined}
                      author={v.author || undefined}
                      dateLabel={mounted ? formatDateLabel(v.publishedAt) : undefined}
                      readingTime={estimateReadingTime(htmlToText(v.body))}
                      coverUrl={v.coverImage?.url}
                      coverAlt={v.coverImage?.alt}
                      bodyHtml={v.body}
                      reviewer={previewReviewer}
                      lastReviewedAt={v.lastReviewedAt || undefined}
                      className="!max-w-none !py-6"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full flex-none space-y-4 lg:w-80">
          <Panel title="Visibility">
            <VisibilityCard
              visibility={v.visibility}
              publishedAt={v.publishedAt}
              onChange={(patch) => set(patch)}
              mounted={mounted}
            />
          </Panel>

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
            <SearchListingPreview
              title={v.title}
              metaTitle={v.metaTitle}
              excerpt={v.excerpt}
              slug={v.slug}
              mounted={mounted}
            />
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
              placeholder="Stem Cell Guide Team"
              aria-label="Author"
            />
            <p className="text-[12px] text-text-muted">
              Leave blank to use “Stem Cell Guide Team”.
            </p>
          </Panel>

          <Panel title="Medical review">
            <div className="space-y-1.5">
              <Label htmlFor="post-reviewer">Reviewed by</Label>
              <select
                id="post-reviewer"
                className={editorialSelectClass}
                value={v.reviewedBy}
                onChange={(e) => set({ reviewedBy: e.target.value })}
              >
                <option value="">— none —</option>
                {reviewers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.credentials ? `, ${r.credentials}` : ""}
                  </option>
                ))}
              </select>
              {reviewers.length ? (
                <p className="text-[12px] text-text-muted">
                  Adds a “Medically reviewed by” byline + <code>reviewedBy</code>{" "}
                  schema (E-E-A-T). Leave as “none” until a real, credentialed
                  reviewer has signed off.
                </p>
              ) : (
                <p className="text-[12px] text-text-muted">
                  No reviewers yet. Add one under{" "}
                  <Link
                    href="/seoteam/reviewers"
                    className="text-text-link hover:underline"
                  >
                    Reviewers
                  </Link>
                  , then attach it here.
                </p>
              )}
            </div>
            {v.reviewedBy ? (
              <div className="space-y-1.5">
                <Label htmlFor="post-reviewed-at">Last reviewed</Label>
                <Input
                  id="post-reviewed-at"
                  type="date"
                  value={v.lastReviewedAt ? v.lastReviewedAt.slice(0, 10) : ""}
                  onChange={(e) =>
                    set({
                      lastReviewedAt: e.target.value
                        ? new Date(`${e.target.value}T00:00:00Z`).toISOString()
                        : "",
                    })
                  }
                />
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
