"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TextField, SelectField, Label } from "@/components/ui/form-field";
import { Toggle } from "@/components/admin/toggle";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  ContentFlagWarning,
  FaqRepeater,
  KeyFactRepeater,
  ReviewControls,
  editorialSelectClass,
  type FaqItem,
  type KeyFactItem,
} from "@/components/content/editorial-fields";
import { adminFetch } from "@/lib/admin/client";
import { findFlaggedPhrases } from "@/lib/content-flags";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import {
  EVIDENCE_LEVELS,
  LOCATION_KINDS,
  type ContentReviewStatus,
} from "@/lib/enums";
import type { AdminTaxonomyRow, TaxonomyView } from "@/lib/admin/taxonomy";

interface FormState {
  id?: string;
  name: string;
  slug: string;
  parentId?: string;
  category?: string;
  issuingBody?: string;
  kind?: string;
  countryCode?: string;
  region?: string;
  flag?: string;
  lat?: string;
  lng?: string;
  shortDescription?: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  // ── Editorial enrichment ──
  body: string;
  faqs: FaqItem[];
  keyFacts: KeyFactItem[];
  reviewStatus: ContentReviewStatus;
  reviewedBy: string;
  flagsAcknowledged: boolean;
  mechanism: string;
  evidenceLevel: string;
  evidenceSummary: string;
  costRange: string;
  recoveryTimeline: string;
  risks: string;
  overview: string;
  standardOfCare: string;
  evidenceForCellTherapy: string;
  symptoms: string;
  regulatoryStatus: string;
  logistics: string;
  travelNotes: string;
}

const EDITORIAL_BLANK = {
  body: "",
  faqs: [] as FaqItem[],
  keyFacts: [] as KeyFactItem[],
  reviewStatus: "draft" as ContentReviewStatus,
  reviewedBy: "",
  flagsAcknowledged: false,
  mechanism: "",
  evidenceLevel: "",
  evidenceSummary: "",
  costRange: "",
  recoveryTimeline: "",
  risks: "",
  overview: "",
  standardOfCare: "",
  evidenceForCellTherapy: "",
  symptoms: "",
  regulatoryStatus: "",
  logistics: "",
  travelNotes: "",
};

function blank(isLocation: boolean): FormState {
  return {
    name: "",
    slug: "",
    isActive: true,
    kind: isLocation ? "country" : undefined,
    ...EDITORIAL_BLANK,
  };
}

function fromRow(r: AdminTaxonomyRow): FormState {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    parentId: r.parentId,
    category: r.category ?? "",
    issuingBody: r.issuingBody ?? "",
    kind: r.kind,
    countryCode: r.countryCode ?? "",
    region: r.region ?? "",
    flag: r.flag ?? "",
    lat: r.lat != null ? String(r.lat) : "",
    lng: r.lng != null ? String(r.lng) : "",
    shortDescription: r.shortDescription ?? "",
    description: r.description ?? "",
    icon: r.icon ?? "",
    isActive: r.isActive,
    body: r.body ?? "",
    faqs: r.faqs.map((f) => ({ question: f.question, answer: f.answer })),
    keyFacts: r.keyFacts.map((k) => ({
      label: k.label,
      value: k.value,
      sourceUrl: k.sourceUrl ?? "",
    })),
    reviewStatus: (r.reviewStatus as ContentReviewStatus) ?? "draft",
    reviewedBy: r.reviewedBy ?? "",
    flagsAcknowledged: r.flagsAcknowledged,
    mechanism: r.mechanism ?? "",
    evidenceLevel: r.evidenceLevel ?? "",
    evidenceSummary: r.evidenceSummary ?? "",
    costRange: r.costRange ?? "",
    recoveryTimeline: r.recoveryTimeline ?? "",
    risks: r.risks ?? "",
    overview: r.overview ?? "",
    standardOfCare: r.standardOfCare ?? "",
    evidenceForCellTherapy: r.evidenceForCellTherapy ?? "",
    symptoms: r.symptoms.join(", "),
    regulatoryStatus: r.regulatoryStatus ?? "",
    logistics: r.logistics ?? "",
    travelNotes: r.travelNotes ?? "",
  };
}

/** Labeled markdown textarea for an editorial field. */
function MdField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

export function TaxonomyManager({ view }: { view: TaxonomyView }) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(blank(view.isLocation));
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Reset editor when switching taxonomy kind.
  React.useEffect(() => {
    setForm(blank(view.isLocation));
    setSlugTouched(false);
  }, [view.segment, view.isLocation]);

  const base = `/api/admin/taxonomy/${view.segment}`;
  const set = (patch: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  const selectRow = (r: AdminTaxonomyRow) => {
    setForm(fromRow(r));
    setSlugTouched(true);
  };
  const startCreate = () => {
    setForm(blank(view.isLocation));
    setSlugTouched(false);
  };

  const onName = (name: string) =>
    set({ name, slug: slugTouched ? form.slug : slugify(name) });

  const buildPayload = () => {
    const num = (v?: string) =>
      v == null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v);
    const payload: Record<string, unknown> = {
      name: form.name,
      slug: form.slug,
      parentId: form.parentId || undefined,
      shortDescription: form.shortDescription || undefined,
      description: form.description || undefined,
      icon: form.icon || undefined,
      isActive: form.isActive,
      // ── Common editorial (all kinds) ──
      body: form.body || undefined,
      faqs: form.faqs.filter((f) => f.question.trim() && f.answer.trim()),
      keyFacts: form.keyFacts
        .filter((k) => k.label.trim() && k.value.trim())
        .map((k) => ({
          label: k.label.trim(),
          value: k.value.trim(),
          sourceUrl: k.sourceUrl.trim() || undefined,
        })),
      reviewStatus: form.reviewStatus,
      reviewedBy: form.reviewedBy || null,
      flagsAcknowledged: form.flagsAcknowledged,
    };
    if (view.hasCategory) payload.category = form.category || undefined;
    if (view.hasIssuingBody)
      payload.issuingBody = form.issuingBody || undefined;
    if (view.isLocation) {
      payload.kind = form.kind || "country";
      payload.countryCode = form.countryCode || undefined;
      payload.region = form.region || undefined;
      payload.flag = form.flag || undefined;
      payload.lat = num(form.lat);
      payload.lng = num(form.lng);
    }
    // ── Per-kind editorial extras ──
    if (view.kind === "treatment") {
      payload.mechanism = form.mechanism || undefined;
      payload.evidenceLevel = form.evidenceLevel || undefined;
      payload.evidenceSummary = form.evidenceSummary || undefined;
      payload.costRange = form.costRange || undefined;
      payload.recoveryTimeline = form.recoveryTimeline || undefined;
      payload.risks = form.risks || undefined;
    } else if (view.kind === "condition") {
      payload.overview = form.overview || undefined;
      payload.standardOfCare = form.standardOfCare || undefined;
      payload.evidenceForCellTherapy = form.evidenceForCellTherapy || undefined;
      payload.symptoms = form.symptoms
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (view.kind === "location") {
      payload.regulatoryStatus = form.regulatoryStatus || undefined;
      payload.logistics = form.logistics || undefined;
      payload.travelNotes = form.travelNotes || undefined;
    }
    return payload;
  };

  // Live cure/guarantee scan (server independently re-scans + enforces the gate).
  const flags = React.useMemo(
    () =>
      findFlaggedPhrases([
        form.body,
        form.description ?? "",
        form.mechanism,
        form.evidenceSummary,
        form.costRange,
        form.recoveryTimeline,
        form.risks,
        form.overview,
        form.standardOfCare,
        form.evidenceForCellTherapy,
        form.regulatoryStatus,
        form.logistics,
        form.travelNotes,
        ...form.faqs.flatMap((f) => [f.question, f.answer]),
        ...form.keyFacts.flatMap((k) => [k.label, k.value]),
      ]),
    [form],
  );

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Name and slug are required.");
      return;
    }
    setBusy(true);
    try {
      if (form.id) {
        await adminFetch(`${base}/${form.id}`, {
          method: "PATCH",
          body: buildPayload(),
        });
        toast.success("Saved");
      } else {
        await adminFetch(base, { method: "POST", body: buildPayload() });
        toast.success(`${view.singular} created`);
        startCreate();
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (r: AdminTaxonomyRow) => {
    try {
      await adminFetch(`${base}/${r.id}`, {
        method: "PATCH",
        body: { isActive: !r.isActive },
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    }
  };

  const reorder = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= view.rows.length) return;
    const ids = view.rows.map((r) => r.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await adminFetch(`${base}/reorder`, { method: "POST", body: { ids } });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder.");
    }
  };

  return (
    <>
      <PageHeader title={view.label}>
        <Button size="sm" onClick={startCreate}>
          <Plus className="size-4" />
          Add {view.singular}
        </Button>
      </PageHeader>

      <div className="flex flex-col items-start gap-5 p-5 lg:flex-row lg:p-7">
        {/* List */}
        <div className="w-full flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[28px_1fr_70px_56px_40px] items-center gap-2 border-b border-border bg-surface-alt px-3.5 py-2.5 text-[12px] font-semibold text-text-secondary">
            <span />
            <span>Name</span>
            <span>Clinics</span>
            <span>Active</span>
            <span />
          </div>
          {view.rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-muted">
              No {view.label.toLowerCase()} yet.
            </p>
          ) : (
            view.rows.map((r, i) => (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-[28px_1fr_70px_56px_40px] items-center gap-2 border-b border-slate-100 px-3.5 py-3 last:border-0",
                  form.id === r.id && "bg-background",
                )}
              >
                <div className="flex flex-col text-text-muted">
                  <button
                    type="button"
                    onClick={() => reorder(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="disabled:opacity-30"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => reorder(i, 1)}
                    disabled={i === view.rows.length - 1}
                    aria-label="Move down"
                    className="disabled:opacity-30"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => selectRow(r)}
                  className="min-w-0 text-left"
                >
                  <div className="truncate text-sm font-semibold text-text-primary">
                    {r.name}
                  </div>
                  <div className="truncate text-xs text-text-muted">
                    /{view.segment}/{r.slug}
                  </div>
                </button>
                <span className="text-[13px] text-text-secondary">
                  {r.clinicCount}
                </span>
                <Toggle
                  checked={r.isActive}
                  onCheckedChange={() => toggleActive(r)}
                  label={`Active: ${r.name}`}
                />
                <GripVertical className="size-4 text-border-strong" />
              </div>
            ))
          )}
        </div>

        {/* Editor panel */}
        <div className="w-full flex-none rounded-xl border border-border bg-surface p-5 lg:w-[360px]">
          <div className="mb-4 font-display text-base font-semibold">
            {form.id ? `Edit ${view.singular}` : `New ${view.singular}`}
          </div>
          <div className="space-y-3.5">
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => onName(e.target.value)}
            />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set({ slug: e.target.value });
              }}
            />
            {view.hasCategory ? (
              <TextField
                label="Category group"
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
              />
            ) : null}
            {view.hasIssuingBody ? (
              <TextField
                label="Issuing body"
                value={form.issuingBody}
                onChange={(e) => set({ issuingBody: e.target.value })}
              />
            ) : null}
            {view.isLocation ? (
              <>
                <SelectField
                  label="Kind"
                  options={LOCATION_KINDS.map((k) => ({ value: k, label: k }))}
                  value={form.kind}
                  onValueChange={(v) => set({ kind: v })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Country code"
                    value={form.countryCode}
                    onChange={(e) => set({ countryCode: e.target.value })}
                  />
                  <TextField
                    label="Flag emoji"
                    value={form.flag}
                    onChange={(e) => set({ flag: e.target.value })}
                  />
                  <TextField
                    label="Latitude"
                    type="number"
                    value={form.lat}
                    onChange={(e) => set({ lat: e.target.value })}
                  />
                  <TextField
                    label="Longitude"
                    type="number"
                    value={form.lng}
                    onChange={(e) => set({ lng: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            {view.parentOptions.filter((o) => o.value !== form.id).length >
            0 ? (
              <SelectField
                label="Parent group"
                placeholder="None"
                options={view.parentOptions.filter((o) => o.value !== form.id)}
                value={form.parentId}
                onValueChange={(v) => set({ parentId: v })}
              />
            ) : null}
            <div className="space-y-1.5">
              <Label>SEO description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Intro copy shown on this term's directory page."
              />
            </div>
            <TextField
              label="Icon (Lucide name)"
              value={form.icon}
              onChange={(e) => set({ icon: e.target.value })}
              placeholder="Activity"
            />
            <label className="flex items-center justify-between py-1">
              <span className="text-[13.5px] font-semibold text-slate-700">
                Active
              </span>
              <Toggle
                checked={form.isActive}
                onCheckedChange={(c) => set({ isActive: c })}
                label="Active"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={save} disabled={busy}>
                {form.id ? "Save changes" : `Create ${view.singular}`}
              </Button>
              {form.id ? (
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Editorial content (review-gated) */}
      <div className="px-5 pb-8 lg:px-7">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 font-display text-base font-semibold">
            Editorial content — {form.name || `new ${view.singular}`}
          </div>
          <p className="mb-4 text-[13px] text-text-muted">
            Long-form content for this term&apos;s page. Rendered publicly only
            when <strong>approved</strong> — the cure/guarantee scanner and an
            assigned medical reviewer gate approval.
          </p>

          <ContentFlagWarning flags={flags} />

          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="min-w-0 space-y-4">
              <MdField
                label="Body (markdown)"
                rows={6}
                value={form.body}
                onChange={(e) => set({ body: e.target.value })}
                placeholder="Long-form overview rendered below the intro."
              />

              {view.kind === "treatment" ? (
                <>
                  <MdField
                    label="How it works"
                    value={form.mechanism}
                    onChange={(e) => set({ mechanism: e.target.value })}
                  />
                  <div className="space-y-1.5">
                    <Label>Evidence level</Label>
                    <select
                      className={editorialSelectClass}
                      value={form.evidenceLevel}
                      onChange={(e) => set({ evidenceLevel: e.target.value })}
                    >
                      <option value="">— not set —</option>
                      {EVIDENCE_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <MdField
                    label="What the evidence shows"
                    value={form.evidenceSummary}
                    onChange={(e) => set({ evidenceSummary: e.target.value })}
                  />
                  <MdField
                    label="Typical cost"
                    value={form.costRange}
                    onChange={(e) => set({ costRange: e.target.value })}
                  />
                  <MdField
                    label="Recovery timeline"
                    value={form.recoveryTimeline}
                    onChange={(e) => set({ recoveryTimeline: e.target.value })}
                  />
                  <MdField
                    label="Risks & considerations"
                    value={form.risks}
                    onChange={(e) => set({ risks: e.target.value })}
                  />
                </>
              ) : null}

              {view.kind === "condition" ? (
                <>
                  <MdField
                    label="Overview"
                    value={form.overview}
                    onChange={(e) => set({ overview: e.target.value })}
                  />
                  <MdField
                    label="Standard of care"
                    value={form.standardOfCare}
                    onChange={(e) => set({ standardOfCare: e.target.value })}
                  />
                  <MdField
                    label="Evidence for cell therapy"
                    value={form.evidenceForCellTherapy}
                    onChange={(e) =>
                      set({ evidenceForCellTherapy: e.target.value })
                    }
                  />
                  <div className="space-y-1.5">
                    <Label>Symptoms (comma-separated)</Label>
                    <Input
                      value={form.symptoms}
                      onChange={(e) => set({ symptoms: e.target.value })}
                      placeholder="e.g. knee pain, stiffness, swelling"
                    />
                  </div>
                </>
              ) : null}

              {view.kind === "location" ? (
                <>
                  <MdField
                    label="Regulatory status"
                    value={form.regulatoryStatus}
                    onChange={(e) => set({ regulatoryStatus: e.target.value })}
                  />
                  <MdField
                    label="Getting there & logistics"
                    value={form.logistics}
                    onChange={(e) => set({ logistics: e.target.value })}
                  />
                  <MdField
                    label="Travel notes"
                    value={form.travelNotes}
                    onChange={(e) => set({ travelNotes: e.target.value })}
                  />
                </>
              ) : null}

              <FaqRepeater
                value={form.faqs}
                onChange={(faqs) => set({ faqs })}
              />
              <KeyFactRepeater
                value={form.keyFacts}
                onChange={(keyFacts) => set({ keyFacts })}
              />
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="mb-3 font-display text-sm font-semibold text-text-primary">
                  Review
                </div>
                <ReviewControls
                  reviewStatus={form.reviewStatus}
                  onReviewStatusChange={(reviewStatus) => set({ reviewStatus })}
                  reviewedBy={form.reviewedBy}
                  onReviewedByChange={(reviewedBy) => set({ reviewedBy })}
                  flagsAcknowledged={form.flagsAcknowledged}
                  onFlagsAcknowledgedChange={(flagsAcknowledged) =>
                    set({ flagsAcknowledged })
                  }
                  reviewers={view.reviewers}
                />
              </div>
              <Button className="w-full" onClick={save} disabled={busy}>
                {form.id ? "Save changes" : `Create ${view.singular}`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${view.singular}`}
        description={`Delete "${form.name}"? Terms still used by clinics can't be deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!form.id) return;
          try {
            await adminFetch(`${base}/${form.id}`, { method: "DELETE" });
            toast.success("Deleted");
            startCreate();
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not delete.");
          }
        }}
      />
    </>
  );
}
