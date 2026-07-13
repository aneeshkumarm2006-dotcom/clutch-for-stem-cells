"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import { TWITTER_CARD_TYPES, type TwitterCardType } from "@/lib/enums";
import type { SeoInput } from "@/lib/validation/common";

/**
 * Per-page SEO panel — one controlled component, dropped into any record editor.
 *
 * Covers the full override set: meta title/description, canonical, robots
 * (index/follow), OpenGraph title/description/image, Twitter card, and the
 * editorial focus keyword. Everything is optional; a blank field means "inherit"
 * (page-derived value → Settings default → config constant), which is exactly
 * the precedence `buildMetadata` implements — so the placeholders below show the
 * real inherited value rather than a generic hint.
 *
 * Idiom-neutral (`value`/`onChange`) so it fits both admin surfaces.
 */

const selectClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-border-strong";

const TITLE_RANGE = { min: 30, max: 60 };
const DESC_RANGE = { min: 70, max: 160 };

export interface SeoPanelProps {
  value: SeoInput;
  onChange: (next: SeoInput) => void;
  /** The page's own title/description — shown as the inherited placeholder. */
  fallbackTitle?: string;
  fallbackDescription?: string;
  /** Root-relative path, for the SERP preview's URL line. */
  path?: string;
  /** Rendered inside the panel — e.g. an image picker for the OG image. */
  ogImageField?: React.ReactNode;
}

function CharCount({
  len,
  min,
  max,
}: {
  len: number;
  min: number;
  max: number;
}) {
  if (!len) return null;
  const ok = len >= min && len <= max;
  return (
    <span className={cn("text-[11.5px]", ok ? "text-success" : "text-warning")}>
      {len} chars · ideal {min}–{max}
    </span>
  );
}

const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

export function SeoPanel({
  value,
  onChange,
  fallbackTitle = "",
  fallbackDescription = "",
  path = "/",
  ogImageField,
}: SeoPanelProps) {
  const set = (patch: Partial<SeoInput>) => onChange({ ...value, ...patch });

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // What the page will *actually* emit, after the inheritance chain.
  const effectiveTitle = value.metaTitle?.trim() || fallbackTitle;
  const effectiveDesc = value.metaDescription?.trim() || fallbackDescription;
  const effectiveOgTitle = value.ogTitle?.trim() || effectiveTitle;
  const effectiveOgDesc = value.ogDescription?.trim() || effectiveDesc;

  const robots = value.robots ?? {};
  // Unset = indexable/followable (that is what `buildMetadata` resolves to).
  const index = robots.index !== false && !value.noindex;
  const follow = robots.follow !== false;

  return (
    <div className="space-y-4">
      {/* ── Search appearance ─────────────────────────────────────────────── */}
      <SerpPreview
        title={effectiveTitle}
        description={effectiveDesc}
        path={path}
        mounted={mounted}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-meta-title">Meta title</Label>
          <CharCount
            len={effectiveTitle.length}
            min={TITLE_RANGE.min}
            max={TITLE_RANGE.max}
          />
        </div>
        <Input
          id="seo-meta-title"
          value={value.metaTitle ?? ""}
          onChange={(e) => set({ metaTitle: e.target.value })}
          placeholder={fallbackTitle || "Defaults to the page title"}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-meta-desc">Meta description</Label>
          <CharCount
            len={effectiveDesc.length}
            min={DESC_RANGE.min}
            max={DESC_RANGE.max}
          />
        </div>
        <Textarea
          id="seo-meta-desc"
          rows={3}
          value={value.metaDescription ?? ""}
          onChange={(e) => set({ metaDescription: e.target.value })}
          placeholder={
            fallbackDescription || "One-sentence summary for search results."
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-focus-kw">Focus keyword</Label>
        <Input
          id="seo-focus-kw"
          value={value.focusKeyword ?? ""}
          onChange={(e) => set({ focusKeyword: e.target.value })}
          placeholder="The one query this page should win"
        />
        <p className="text-[11.5px] text-text-muted">
          Editorial only — never emitted to the page.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-canonical">Canonical URL</Label>
        <Input
          id="seo-canonical"
          value={value.canonicalUrl ?? ""}
          onChange={(e) => set({ canonicalUrl: e.target.value })}
          placeholder="Defaults to this page's own URL"
        />
      </div>

      {/* ── Robots ───────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>Search engines</Label>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              checked={index}
              onChange={(e) =>
                set({
                  // Keep the legacy `noindex` flag in lockstep with the granular
                  // control so old readers of `seo.noindex` stay correct.
                  noindex: !e.target.checked,
                  robots: { ...robots, index: e.target.checked },
                })
              }
            />
            Allow indexing
          </label>
          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) =>
                set({ robots: { ...robots, follow: e.target.checked } })
              }
            />
            Follow links
          </label>
        </div>
        {!index ? (
          <p className="text-[11.5px] text-warning">
            This page will be excluded from search results and the sitemap.
          </p>
        ) : null}
      </div>

      {/* ── Social ───────────────────────────────────────────────────────── */}
      <div className="border-t border-border pt-3">
        <p className="mb-2 font-display text-[13px] font-semibold text-text-primary">
          Social preview
        </p>

        <OgPreview
          title={effectiveOgTitle}
          description={effectiveOgDesc}
          image={value.ogImage}
          path={path}
          mounted={mounted}
        />

        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="seo-og-title">OG title</Label>
            <Input
              id="seo-og-title"
              value={value.ogTitle ?? ""}
              onChange={(e) => set({ ogTitle: e.target.value })}
              placeholder={effectiveTitle || "Defaults to the meta title"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seo-og-desc">OG description</Label>
            <Textarea
              id="seo-og-desc"
              rows={2}
              value={value.ogDescription ?? ""}
              onChange={(e) => set({ ogDescription: e.target.value })}
              placeholder={
                effectiveDesc || "Defaults to the meta description"
              }
            />
          </div>

          {ogImageField ?? (
            <div className="space-y-1.5">
              <Label htmlFor="seo-og-image">OG image URL</Label>
              <Input
                id="seo-og-image"
                value={value.ogImage ?? ""}
                onChange={(e) => set({ ogImage: e.target.value })}
                placeholder="Defaults to the site-wide share image"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="seo-twitter-card">Twitter card</Label>
            <select
              id="seo-twitter-card"
              className={selectClass}
              value={value.twitterCard ?? ""}
              onChange={(e) =>
                set({
                  twitterCard: (e.target.value || undefined) as
                    | TwitterCardType
                    | undefined,
                })
              }
            >
              <option value="">Site default (large image)</option>
              {TWITTER_CARD_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c === "summary_large_image" ? "Large image" : "Summary"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Google-style result. Mirrors what `buildMetadata` will emit. */
function SerpPreview({
  title,
  description,
  path,
  mounted,
}: {
  title: string;
  description: string;
  path: string;
  mounted: boolean;
}) {
  const host = mounted ? window.location.host : "yoursite.com";
  const crumbs = path.split("/").filter(Boolean).join(" › ");

  return (
    <div className="rounded-md border border-border bg-surface-alt/40 p-3">
      <div className="truncate text-[12px] text-text-muted">
        {host}
        {crumbs ? ` › ${crumbs}` : ""}
      </div>
      <div className="mt-0.5 truncate text-[18px] leading-snug text-[#1a0dab]">
        {truncate(title || "Untitled page", 60)}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[13px] leading-snug",
          description ? "text-text-secondary" : "italic text-text-muted",
        )}
      >
        {description
          ? truncate(description, 160)
          : "Add a meta description to control how this reads in search results."}
      </div>
    </div>
  );
}

/** OpenGraph share card, as it appears when the URL is pasted into a feed. */
function OgPreview({
  title,
  description,
  image,
  path,
  mounted,
}: {
  title: string;
  description: string;
  image?: string;
  path: string;
  mounted: boolean;
}) {
  const host = mounted ? window.location.host : "yoursite.com";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative flex aspect-[1.91/1] items-center justify-center bg-tint">
        {image ? (
          // A plain <img>: the OG image is an arbitrary editor-supplied URL, which
          // next/image would refuse unless the host is whitelisted.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <span className="text-[12px] text-text-muted">
            No share image — the site default will be used
          </span>
        )}
      </div>
      <div className="border-t border-border p-2.5">
        <div className="text-[11px] uppercase tracking-wide text-text-muted">
          {host}
          {path}
        </div>
        <div className="mt-0.5 truncate font-display text-[13.5px] font-semibold text-text-primary">
          {truncate(title || "Untitled page", 70)}
        </div>
        {description ? (
          <div className="mt-0.5 line-clamp-2 text-[12px] text-text-secondary">
            {truncate(description, 120)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
