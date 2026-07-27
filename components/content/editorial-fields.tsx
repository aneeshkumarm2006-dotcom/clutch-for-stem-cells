"use client";

import * as React from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/form-field";
import { CONTENT_REVIEW_STATUSES, type ContentReviewStatus } from "@/lib/enums";

/** Shared editorial form controls used by the matrix CMS + admin taxonomy form. */

export interface FaqItem {
  question: string;
  answer: string;
}
export interface KeyFactItem {
  label: string;
  value: string;
  sourceUrl: string;
}
export interface ReviewerOption {
  id: string;
  name: string;
  credentials?: string;
}

export const editorialSelectClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-border-strong";

export const REVIEW_STATUS_LABELS: Record<ContentReviewStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved (live)",
};

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove"
      className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-alt hover:text-danger"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function RepeaterShell({
  title,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-sm font-semibold text-text-primary">
          {title}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onAdd}>
          <Plus className="size-4" /> {addLabel}
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function FaqRepeater({
  value,
  onChange,
}: {
  value: FaqItem[];
  onChange: (v: FaqItem[]) => void;
}) {
  const update = (i: number, patch: Partial<FaqItem>) =>
    onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <RepeaterShell
      title="FAQ (scoped Q&A)"
      addLabel="Add question"
      onAdd={() => onChange([...value, { question: "", answer: "" }])}
    >
      {value.length ? (
        value.map((f, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <Input
                value={f.question}
                onChange={(e) => update(i, { question: e.target.value })}
                placeholder="Question phrased as a real search query"
              />
              <Textarea
                rows={2}
                value={f.answer}
                onChange={(e) => update(i, { answer: e.target.value })}
                placeholder="Direct, cautious answer"
              />
            </div>
            <RemoveButton
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            />
          </div>
        ))
      ) : (
        <p className="text-[13px] text-text-muted">
          Add at least 3 Q&amp;A pairs to help the page qualify for indexing.
        </p>
      )}
    </RepeaterShell>
  );
}

export function KeyFactRepeater({
  value,
  onChange,
}: {
  value: KeyFactItem[];
  onChange: (v: KeyFactItem[]) => void;
}) {
  const update = (i: number, patch: Partial<KeyFactItem>) =>
    onChange(value.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  return (
    <RepeaterShell
      title="Key facts (with sources)"
      addLabel="Add fact"
      onAdd={() =>
        onChange([...value, { label: "", value: "", sourceUrl: "" }])
      }
    >
      {value.length ? (
        value.map((k, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              <Input
                value={k.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label"
              />
              <Input
                value={k.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="Value"
              />
              <Input
                value={k.sourceUrl}
                onChange={(e) => update(i, { sourceUrl: e.target.value })}
                placeholder="Source URL"
              />
            </div>
            <RemoveButton
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            />
          </div>
        ))
      ) : (
        <p className="text-[13px] text-text-muted">
          Cite primary sources (PubMed, clinicaltrials.gov, regulators).
        </p>
      )}
    </RepeaterShell>
  );
}

/** Live cure/guarantee warning (server independently re-scans + enforces the gate). */
export function ContentFlagWarning({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
      <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-warning">
        <AlertTriangle className="size-4" /> Flagged phrases
      </div>
      <p className="text-[12.5px] text-text-secondary">
        {flags.join(", ")}. Approval is blocked until a reviewer acknowledges
        these.
      </p>
    </div>
  );
}

/** Review status + reviewer picker + flag acknowledgement (the approval gate UI). */
export function ReviewControls({
  reviewStatus,
  onReviewStatusChange,
  reviewedBy,
  onReviewedByChange,
  flagsAcknowledged,
  onFlagsAcknowledgedChange,
  reviewers,
}: {
  reviewStatus: ContentReviewStatus;
  onReviewStatusChange: (s: ContentReviewStatus) => void;
  reviewedBy: string;
  onReviewedByChange: (id: string) => void;
  flagsAcknowledged: boolean;
  onFlagsAcknowledgedChange: (v: boolean) => void;
  reviewers: ReviewerOption[];
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Status</Label>
        <select
          className={editorialSelectClass}
          value={reviewStatus}
          onChange={(e) =>
            onReviewStatusChange(e.target.value as ContentReviewStatus)
          }
        >
          {CONTENT_REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REVIEW_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Medical reviewer</Label>
        <select
          className={editorialSelectClass}
          value={reviewedBy}
          onChange={(e) => onReviewedByChange(e.target.value)}
        >
          <option value="">None</option>
          {reviewers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.credentials ? `, ${r.credentials}` : ""}
            </option>
          ))}
        </select>
        {!reviewers.length ? (
          <p className="text-[12px] text-text-muted">
            No reviewers yet. Add one before approving.
          </p>
        ) : null}
      </div>
      <label className="flex items-start gap-2 text-[13px] text-text-secondary">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={flagsAcknowledged}
          onChange={(e) => onFlagsAcknowledgedChange(e.target.checked)}
        />
        Reviewer has acknowledged all flagged phrases
      </label>
    </div>
  );
}
