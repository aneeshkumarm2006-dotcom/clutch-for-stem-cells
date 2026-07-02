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
import { RichTextEditor } from "@/components/seoteam/rich-text-editor";
import {
  ContentFlagWarning,
  FaqRepeater,
  KeyFactRepeater,
  REVIEW_STATUS_LABELS,
  ReviewControls,
  editorialSelectClass,
  type ReviewerOption,
} from "@/components/content/editorial-fields";
import { adminFetch } from "@/lib/admin/client";
import { findFlaggedPhrases } from "@/lib/content-flags";
import { type ContentReviewStatus, type MatrixKind } from "@/lib/enums";

export interface SlugOption {
  slug: string;
  name: string;
}

export interface MatrixTaxonomyOptions {
  treatments: SlugOption[];
  conditions: SlugOption[];
  countries: SlugOption[];
}

export interface MatrixEditorValues {
  kind: MatrixKind;
  slugA: string;
  slugB: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  body: string;
  faqs: { question: string; answer: string }[];
  keyFacts: { label: string; value: string; sourceUrl: string }[];
  reviewStatus: ContentReviewStatus;
  reviewedBy: string;
  flagsAcknowledged: boolean;
}

const KIND_AXES: Record<
  MatrixKind,
  {
    a: keyof MatrixTaxonomyOptions;
    b: keyof MatrixTaxonomyOptions;
    aLabel: string;
    bLabel: string;
  }
> = {
  treatment_condition: {
    a: "treatments",
    b: "conditions",
    aLabel: "Treatment",
    bLabel: "Condition",
  },
  treatment_country: {
    a: "treatments",
    b: "countries",
    aLabel: "Treatment",
    bLabel: "Destination",
  },
  condition_country: {
    a: "conditions",
    b: "countries",
    aLabel: "Condition",
    bLabel: "Destination",
  },
};

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

export function MatrixEditor({
  mode,
  pageId,
  initial,
  reviewers,
  options,
  existingPath,
}: {
  mode: "create" | "edit";
  pageId?: string;
  initial: MatrixEditorValues;
  reviewers: ReviewerOption[];
  options: MatrixTaxonomyOptions;
  existingPath?: string;
}) {
  const router = useRouter();
  const [v, setV] = React.useState<MatrixEditorValues>(initial);
  const [saving, setSaving] = React.useState(false);
  const set = (patch: Partial<MatrixEditorValues>) =>
    setV((cur) => ({ ...cur, ...patch }));

  const axes = KIND_AXES[v.kind];

  // Live cure/guarantee scan (server independently re-scans + enforces the gate).
  const flags = React.useMemo(
    () =>
      findFlaggedPhrases([
        v.title,
        v.intro,
        v.body,
        ...v.faqs.flatMap((f) => [f.question, f.answer]),
        ...v.keyFacts.flatMap((k) => [k.label, k.value]),
      ]),
    [v.title, v.intro, v.body, v.faqs, v.keyFacts],
  );

  const save = async () => {
    if (!v.title.trim()) return toast.error("A title is required.");
    if (mode === "create" && (!v.slugA || !v.slugB)) {
      return toast.error("Pick both sides of the combination.");
    }
    const editorial = {
      title: v.title.trim(),
      metaTitle: v.metaTitle.trim() || undefined,
      metaDescription: v.metaDescription.trim() || undefined,
      intro: v.intro.trim() || undefined,
      body: v.body,
      faqs: v.faqs.filter((f) => f.question.trim() && f.answer.trim()),
      keyFacts: v.keyFacts
        .filter((k) => k.label.trim() && k.value.trim())
        .map((k) => ({
          label: k.label.trim(),
          value: k.value.trim(),
          sourceUrl: k.sourceUrl.trim() || undefined,
        })),
      reviewStatus: v.reviewStatus,
      reviewedBy: v.reviewedBy || null,
      flagsAcknowledged: v.flagsAcknowledged,
    };

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await adminFetch<{ id: string }>("/api/seoteam/matrix", {
          method: "POST",
          body: { kind: v.kind, slugA: v.slugA, slugB: v.slugB, ...editorial },
        });
        toast.success("Saved");
        router.push(`/seoteam/matrix/${res.id}`);
        router.refresh();
      } else {
        await adminFetch(`/api/seoteam/matrix/${pageId}`, {
          method: "PATCH",
          body: editorial,
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
            href="/seoteam/matrix"
            className="hidden text-[13px] text-text-muted hover:text-text-secondary sm:inline"
          >
            Combinations /
          </Link>
          <h1 className="truncate font-display text-base font-bold text-text-primary lg:text-lg">
            {mode === "create" ? "New combination page" : v.title || "Page"}
          </h1>
          <Badge
            variant={v.reviewStatus === "approved" ? "success" : "neutral"}
          >
            {REVIEW_STATUS_LABELS[v.reviewStatus]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && v.reviewStatus === "approved" && existingPath ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={existingPath} target="_blank">
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
            {mode === "create" ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select
                    className={editorialSelectClass}
                    value={v.kind}
                    onChange={(e) =>
                      set({
                        kind: e.target.value as MatrixKind,
                        slugA: "",
                        slugB: "",
                      })
                    }
                  >
                    <option value="treatment_condition">
                      Treatment × condition
                    </option>
                    <option value="treatment_country">
                      Treatment × destination
                    </option>
                    <option value="condition_country">
                      Condition × destination
                    </option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{axes.aLabel}</Label>
                  <select
                    className={editorialSelectClass}
                    value={v.slugA}
                    onChange={(e) => set({ slugA: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {options[axes.a].map((o) => (
                      <option key={o.slug} value={o.slug}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{axes.bLabel}</Label>
                  <select
                    className={editorialSelectClass}
                    value={v.slugB}
                    onChange={(e) => set({ slugB: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {options[axes.b].map((o) => (
                      <option key={o.slug} value={o.slug}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="mb-4 text-[13px] text-text-muted">{existingPath}</p>
            )}

            <input
              value={v.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Page title (e.g. MSC therapy for knee osteoarthritis)"
              aria-label="Title"
              className="mb-4 w-full border-none bg-transparent font-display text-2xl font-bold tracking-[-0.02em] text-text-primary outline-none placeholder:text-text-muted"
            />

            <div className="space-y-1.5">
              <Label htmlFor="matrix-intro">
                Answer-first summary (40–60 words)
              </Label>
              <Textarea
                id="matrix-intro"
                rows={3}
                value={v.intro}
                onChange={(e) => set({ intro: e.target.value })}
                placeholder="A direct, cautious answer to the page's core question — the passage answer engines quote."
              />
            </div>

            <div className="mt-4 space-y-1.5">
              <Label>Body</Label>
              <RichTextEditor
                value={v.body}
                onChange={(body) => set({ body })}
              />
            </div>
          </div>

          <FaqRepeater value={v.faqs} onChange={(faqs) => set({ faqs })} />
          <KeyFactRepeater
            value={v.keyFacts}
            onChange={(keyFacts) => set({ keyFacts })}
          />
        </div>

        {/* Sidebar */}
        <div className="w-full flex-none space-y-4 lg:w-80">
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

          <Panel title="Search appearance">
            <div className="space-y-1.5">
              <Label htmlFor="matrix-meta-title">Meta title</Label>
              <Input
                id="matrix-meta-title"
                value={v.metaTitle}
                onChange={(e) => set({ metaTitle: e.target.value })}
                placeholder={v.title || "Defaults to the title"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="matrix-meta-desc">Meta description</Label>
              <Textarea
                id="matrix-meta-desc"
                rows={2}
                value={v.metaDescription}
                onChange={(e) => set({ metaDescription: e.target.value })}
                placeholder="One-sentence summary for search results."
              />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
