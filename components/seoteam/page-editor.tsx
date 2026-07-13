"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/form-field";
import { BlockEditor } from "@/components/blocks/block-editor";
import { SeoPanel } from "@/components/seo/seo-panel";
import { SchemaPanel } from "@/components/seo/schema-panel";
import {
  ContentFlagWarning,
  REVIEW_STATUS_LABELS,
  ReviewControls,
  type ReviewerOption,
} from "@/components/content/editorial-fields";
import { adminFetch } from "@/lib/admin/client";
import { findFlaggedPhrases } from "@/lib/content-flags";
import { slugify } from "@/lib/slug";
import { nodesFor } from "@/config/content-engine";
import { CONTENT_ENGINE } from "@/config/content-engine";
import type { ContentReviewStatus } from "@/lib/enums";
import type { BlockInput } from "@/lib/validation/block";
import type { SchemaOverrideInput, SeoInput } from "@/lib/validation/common";

/**
 * The composed-page editor.
 *
 * Explicit save (like the matrix editor) rather than auto-save: a page here can
 * hold dozens of blocks, and silently persisting a half-composed layout on every
 * keystroke is more surprising than useful.
 *
 * The three panels on the right are the whole point of this feature — the block
 * list produces the content, `SeoPanel` controls how it appears in search and
 * social, and `SchemaPanel` shows (and lets the editor tune) the JSON-LD that
 * falls out of both.
 */

export interface PageEditorValues {
  title: string;
  slug: string;
  intro: string;
  blocks: BlockInput[];
  seo: SeoInput;
  schemaOverrides: SchemaOverrideInput;
  reviewStatus: ContentReviewStatus;
  reviewedBy: string;
  flagsAcknowledged: boolean;
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

export function PageEditor({
  mode,
  pageId,
  initial,
  reviewers,
}: {
  mode: "create" | "edit";
  pageId?: string;
  initial: PageEditorValues;
  reviewers: ReviewerOption[];
}) {
  const router = useRouter();
  const [v, setV] = React.useState<PageEditorValues>(initial);
  const [saving, setSaving] = React.useState(false);
  const [schemaValid, setSchemaValid] = React.useState(true);
  const [slugState, setSlugState] = React.useState<
    "idle" | "checking" | "ok" | "taken" | "reserved"
  >("idle");

  const set = (patch: Partial<PageEditorValues>) =>
    setV((cur) => ({ ...cur, ...patch }));

  // In create mode the slug tracks the title until the editor types their own.
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  const effectiveSlug = slugTouched ? v.slug : slugify(v.title);

  // Live cure/guarantee scan (the server independently re-scans and enforces it).
  const flags = React.useMemo(
    () =>
      findFlaggedPhrases([
        v.title,
        v.intro,
        ...v.blocks.flatMap(blockText),
      ]),
    [v.title, v.intro, v.blocks],
  );

  // Debounced slug availability check.
  React.useEffect(() => {
    const slug = effectiveSlug.trim();
    if (!slug) {
      setSlugState("idle");
      return;
    }
    let cancelled = false;
    setSlugState("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await adminFetch<{ available: boolean; reserved: boolean }>(
          `/api/seoteam/pages/check-slug?slug=${encodeURIComponent(slug)}${
            pageId ? `&id=${pageId}` : ""
          }`,
        );
        if (cancelled) return;
        setSlugState(
          res.reserved ? "reserved" : res.available ? "ok" : "taken",
        );
      } catch {
        if (!cancelled) setSlugState("idle");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [effectiveSlug, pageId]);

  // The values the schema panel previews from.
  const schemaValues = React.useMemo(
    () => ({
      title: v.title,
      slug: effectiveSlug,
      intro: v.intro,
      blocks: v.blocks,
    }),
    [v.title, effectiveSlug, v.intro, v.blocks],
  );

  const save = async () => {
    if (!v.title.trim()) return toast.error("A title is required.");
    if (!effectiveSlug.trim()) return toast.error("A slug is required.");
    if (slugState === "taken") return toast.error("That slug is already taken.");
    if (slugState === "reserved") {
      return toast.error("That slug is reserved by an existing route.");
    }
    // Never let invalid structured data reach the DB.
    if (!schemaValid) {
      return toast.error(
        "Fix the structured-data issues before saving.",
      );
    }

    const payload = {
      title: v.title.trim(),
      slug: effectiveSlug.trim(),
      intro: v.intro.trim() || undefined,
      blocks: v.blocks,
      seo: v.seo,
      schemaOverrides: v.schemaOverrides,
      reviewStatus: v.reviewStatus,
      reviewedBy: v.reviewedBy || null,
      flagsAcknowledged: v.flagsAcknowledged,
    };

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await adminFetch<{ id: string }>("/api/seoteam/pages", {
          method: "POST",
          body: payload,
        });
        toast.success("Saved");
        router.push(`/seoteam/pages/${res.id}`);
        router.refresh();
      } else {
        await adminFetch(`/api/seoteam/pages/${pageId}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success(
          v.reviewStatus === "approved" ? "Approved — live" : "Saved",
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
      {/* Action bar */}
      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/seoteam/pages"
            className="hidden text-[13px] text-text-muted hover:text-text-secondary sm:inline"
          >
            Pages /
          </Link>
          <h1 className="truncate font-display text-base font-bold text-text-primary lg:text-lg">
            {mode === "create" ? "New page" : v.title || "Page"}
          </h1>
          <Badge variant={v.reviewStatus === "approved" ? "success" : "neutral"}>
            {REVIEW_STATUS_LABELS[v.reviewStatus]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && v.reviewStatus === "approved" ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/${v.slug}`} target="_blank">
                <Eye className="size-4" />
                <span className="hidden sm:inline">View</span>
              </Link>
            </Button>
          ) : null}
          <Button size="sm" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 p-4 lg:flex-row lg:p-6">
        {/* Main column */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <input
              value={v.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Page title"
              aria-label="Title"
              className="mb-4 w-full border-none bg-transparent font-display text-2xl font-bold tracking-[-0.02em] text-text-primary outline-none placeholder:text-text-muted"
            />

            <div className="space-y-1.5">
              <Label htmlFor="page-slug">URL</Label>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-text-muted">/</span>
                <Input
                  id="page-slug"
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: e.target.value });
                  }}
                  placeholder="page-url-slug"
                />
              </div>
              <SlugHint state={slugState} />
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="page-intro">
                Answer-first summary (40–60 words)
              </Label>
              <Textarea
                id="page-intro"
                rows={3}
                value={v.intro}
                onChange={(e) => set({ intro: e.target.value })}
                placeholder="A direct answer to the page's core question — the passage answer engines quote."
              />
            </div>
          </div>

          {/* The composition */}
          <div>
            <div className="mb-2 font-display text-sm font-semibold text-text-primary">
              Content blocks
            </div>
            <BlockEditor
              value={v.blocks}
              onChange={(blocks) => set({ blocks })}
              enabledTypes={CONTENT_ENGINE.blocks}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full flex-none space-y-4 lg:w-96">
          <ContentFlagWarning flags={flags} />

          <Panel title="Review">
            <ReviewControls
              reviewStatus={v.reviewStatus}
              onReviewStatusChange={(reviewStatus) => set({ reviewStatus })}
              reviewedBy={v.reviewedBy}
              onReviewedByChange={(reviewedBy) => set({ reviewedBy })}
              flagsAcknowledged={v.flagsAcknowledged}
              onFlagsAcknowledgedChange={(flagsAcknowledged) =>
                set({ flagsAcknowledged })
              }
              reviewers={reviewers}
            />
          </Panel>

          <Panel title="SEO">
            <SeoPanel
              value={v.seo}
              onChange={(seo) => set({ seo })}
              fallbackTitle={v.title}
              fallbackDescription={v.intro}
              path={`/${effectiveSlug}`}
            />
          </Panel>

          <Panel title="Structured data">
            <SchemaPanel
              contentType="page"
              availableNodes={nodesFor("page")}
              values={schemaValues}
              value={v.schemaOverrides}
              onChange={(schemaOverrides) => set({ schemaOverrides })}
              onValidityChange={setSchemaValid}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SlugHint({
  state,
}: {
  state: "idle" | "checking" | "ok" | "taken" | "reserved";
}) {
  if (state === "checking") {
    return <p className="text-[12px] text-text-muted">Checking…</p>;
  }
  if (state === "ok") {
    return <p className="text-[12px] text-success">Available</p>;
  }
  if (state === "taken") {
    return <p className="text-[12px] text-danger">Already taken</p>;
  }
  if (state === "reserved") {
    return (
      <p className="text-[12px] text-danger">
        Reserved by an existing route — pick another.
      </p>
    );
  }
  return null;
}

/** Every string in a block — fed to the live cure/guarantee scanner. */
function blockText(block: BlockInput): string[] {
  switch (block.type) {
    case "richText":
    case "rawHtml":
      return [block.data.html.replace(/<[^>]*>/g, " ")];
    case "faq":
      return block.data.items.flatMap((i) => [i.question, i.answer]);
    case "comparisonTable":
      return block.data.rows.flatMap((r) => [r.label, ...r.cells]);
    case "featureGrid":
      return block.data.items.flatMap((i) => [i.title, i.description ?? ""]);
    case "prosCons":
      return [...block.data.pros, ...block.data.cons];
    case "cta":
      return [block.data.title, block.data.body ?? ""];
    case "media":
      return [block.data.caption ?? ""];
  }
}
