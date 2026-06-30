"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RatingStars, SUB_RATING_LABELS } from "@/components/ui/rating-stars";
import { ReviewStatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import { cn } from "@/lib/utils";
import { SUB_RATING_KEYS } from "@/lib/enums";
import type { AdminReviewRow } from "@/lib/admin/reviews";

const BODY_FIELDS: [keyof AdminReviewRow["body"], string][] = [
  ["condition", "Background / condition"],
  ["whyChosen", "Why chosen"],
  ["treatmentDescription", "Treatment"],
  ["outcome", "Outcome"],
  ["experience", "Experience"],
  ["improvement", "What could be better"],
];

export function ReviewsModeration({ rows }: { rows: AdminReviewRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState(rows[0]?.id ?? null);
  const [busy, setBusy] = React.useState(false);
  const [reject, setReject] = React.useState(false);
  const [spam, setSpam] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const act = async (
    id: string,
    body: Record<string, unknown>,
    okMsg: string,
  ) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/reviews/${id}`, { method: "PATCH", body });
      toast.success(okMsg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-text-muted">
        No reviews in this view.
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col lg:flex-row">
      {/* Queue */}
      <div className="w-full flex-none space-y-3 overflow-y-auto border-b border-border p-4 lg:max-h-[calc(100vh-8rem)] lg:w-[42%] lg:border-b-0 lg:border-r">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedId(r.id)}
            className={cn(
              "w-full rounded-xl border bg-surface p-4 text-left transition-shadow",
              r.id === selected?.id
                ? "border-primary shadow-[0_0_0_3px_rgba(14,128,204,.12)]"
                : "border-border hover:border-border-strong",
            )}
          >
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {r.reviewerName}{" "}
                  <span className="font-normal text-text-muted">
                    → {r.clinicName}
                  </span>
                </div>
                {(r.conditionName || r.treatmentName) && (
                  <div className="truncate text-xs text-text-muted">
                    {[r.conditionName, r.treatmentName].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <ReviewStatusBadge status={r.status} />
            </div>
            <div className="mb-1.5 flex items-center gap-2">
              <RatingStars value={r.ratingOverall} size={13} showValue={false} />
              {r.emailConfirmed ? (
                <Badge variant="info" className="gap-1 text-[10px]">
                  <ShieldCheck className="size-2.5" />
                  Email confirmed
                </Badge>
              ) : null}
              {r.contentFlags.length > 0 ? (
                <Badge variant="warning" className="gap-1 text-[10px]">
                  <AlertTriangle className="size-2.5" />
                  Claim flag
                </Badge>
              ) : null}
            </div>
            <p className="line-clamp-2 text-[13px] text-text-secondary">
              {r.snippet || "—"}
            </p>
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="min-w-0 flex-1 overflow-y-auto p-5 lg:p-7">
        {selected ? (
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display text-base font-semibold">
                  {selected.reviewerName}
                </div>
                <div className="text-[12.5px] text-text-muted">
                  {selected.reviewerEmail ? `${selected.reviewerEmail} (private)` : "Email private"}
                  {selected.country ? ` · ${selected.country}` : ""}
                  {selected.submittedAt
                    ? ` · ${new Date(selected.submittedAt).toLocaleDateString()}`
                    : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected.isVerified ? (
                  <Badge variant="verified" className="gap-1">
                    <ShieldCheck className="size-3" />
                    Verified
                  </Badge>
                ) : null}
                <ReviewStatusBadge status={selected.status} />
              </div>
            </div>

            {/* Ratings */}
            <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-surface-alt px-4 py-3">
              <div>
                <div className="text-[11px] text-text-muted">Overall</div>
                <div className="font-display text-lg font-bold">
                  {selected.ratingOverall.toFixed(1)}
                </div>
              </div>
              {SUB_RATING_KEYS.map((key) =>
                selected.ratings[key] != null ? (
                  <div key={key} className="border-l border-border pl-4">
                    <div className="text-[11px] text-text-muted">
                      {SUB_RATING_LABELS[key]}
                    </div>
                    <div className="font-display text-lg font-bold">
                      {selected.ratings[key]!.toFixed(1)}
                    </div>
                  </div>
                ) : null,
              )}
            </div>

            {selected.contentFlags.length > 0 ? (
              <div className="mb-4 rounded-lg border border-warning-fg/25 bg-warning-bg px-3.5 py-3 text-[12.5px] text-warning-fg">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                  Unsupported-claim language detected
                </div>
                <p className="mt-1 text-warning-fg/90">
                  This review uses phrasing that may imply a guaranteed or
                  curative outcome. Review before approving (§14).
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.contentFlags.map((f) => (
                    <Badge key={f.phrase} variant="warning" className="text-[10px]">
                      “{f.phrase}”
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {selected.headline ? (
              <div className="mb-4 font-display text-[15px] font-semibold">
                “{selected.headline}”
              </div>
            ) : null}

            <div className="mb-5 grid gap-3.5">
              {BODY_FIELDS.map(([key, label]) =>
                selected.body[key] ? (
                  <div key={key}>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-azure-700">
                      {label}
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-slate-700">
                      {selected.body[key]}
                    </p>
                  </div>
                ) : null,
              )}
            </div>

            {selected.cost?.range ? (
              <div className="mb-4 text-[12.5px] text-text-muted">
                Cost reported: {selected.cost.range}{" "}
                {selected.cost.currency ?? ""}
              </div>
            ) : null}

            {selected.whyChosenTags.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {selected.whyChosenTags.map((t) => (
                  <Badge key={t} variant="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : null}

            {selected.rejectionReason ? (
              <div className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-[12.5px] text-[#97231F]">
                Rejection reason: {selected.rejectionReason}
              </div>
            ) : null}

            {/* Provider response moderation */}
            <ProviderResponse review={selected} onAction={act} busy={busy} />

            {/* Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
              {selected.status !== "approved" ? (
                <Button
                  size="sm"
                  className="bg-success hover:brightness-95"
                  disabled={busy}
                  onClick={() => act(selected.id, { action: "approve" }, "Review approved")}
                >
                  <Check className="size-4" />
                  Approve
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                className="border-[#F3C7C6] text-[#97231F]"
                disabled={busy}
                onClick={() => setReject(true)}
              >
                Reject…
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  act(
                    selected.id,
                    { action: selected.isVerified ? "unverify" : "verify" },
                    selected.isVerified ? "Marked unverified" : "Marked verified",
                  )
                }
              >
                {selected.isVerified ? "Unverify" : "Mark verified"}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
                Edit
              </Button>
              {selected.status !== "spam" ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setSpam(true)}>
                  Mark spam
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-danger"
                disabled={busy}
                onClick={() => setDel(true)}
              >
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Dialogs */}
      {selected ? (
        <>
          <ConfirmDialog
            open={reject}
            onOpenChange={setReject}
            title="Reject review"
            description="Add a reason (kept internal; the reviewer may be notified)."
            confirmLabel="Reject"
            destructive
            withReason
            reasonLabel="Reason"
            reasonRequired
            onConfirm={(reason) =>
              act(selected.id, { action: "reject", reason }, "Review rejected")
            }
          />
          <ConfirmDialog
            open={spam}
            onOpenChange={setSpam}
            title="Mark as spam"
            description="Hide this review and exclude it from ratings."
            confirmLabel="Mark spam"
            destructive
            onConfirm={() => act(selected.id, { action: "spam" }, "Marked as spam")}
          />
          <ConfirmDialog
            open={del}
            onOpenChange={setDel}
            title="Delete review"
            description="Soft-delete this review. It can be restored from the database."
            confirmLabel="Delete"
            destructive
            onConfirm={async () => {
              setBusy(true);
              try {
                await adminFetch(`/api/admin/reviews/${selected.id}`, {
                  method: "DELETE",
                });
                toast.success("Review deleted");
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not delete.");
              } finally {
                setBusy(false);
              }
            }}
          />
          <ReviewEditDialog
            open={editing}
            onOpenChange={setEditing}
            review={selected}
            onSaved={() => router.refresh()}
          />
        </>
      ) : null}
    </div>
  );
}

function ProviderResponse({
  review,
  onAction,
  busy,
}: {
  review: AdminReviewRow;
  onAction: (id: string, body: Record<string, unknown>, msg: string) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = React.useState(review.providerResponse?.body ?? "");
  React.useEffect(() => {
    setDraft(review.providerResponse?.body ?? "");
  }, [review.id, review.providerResponse?.body]);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 text-[12px] font-semibold text-text-secondary">
        Provider response {review.providerResponse ? "(moderated)" : ""}
      </div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="Add or edit the clinic's response"
      />
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !draft.trim()}
          onClick={() =>
            onAction(
              review.id,
              { action: "providerResponse", responseBody: draft },
              "Response saved",
            )
          }
        >
          Save response
        </Button>
        {review.providerResponse ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            disabled={busy}
            onClick={() =>
              onAction(review.id, { action: "removeResponse" }, "Response removed")
            }
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ReviewEditDialog({
  open,
  onOpenChange,
  review,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  review: AdminReviewRow;
  onSaved: () => void;
}) {
  const [headline, setHeadline] = React.useState(review.headline ?? "");
  const [body, setBody] = React.useState(review.body);
  const [overall, setOverall] = React.useState(review.ratingOverall);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setHeadline(review.headline ?? "");
      setBody(review.body);
      setOverall(review.ratingOverall);
    }
  }, [open, review]);

  const save = async () => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        body: {
          action: "edit",
          data: { headline, body, ratingOverall: overall },
        },
      });
      toast.success("Review updated");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit review</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Overall rating</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={overall}
              onChange={(e) => setOverall(Number(e.target.value) || 1)}
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Headline</Label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          {BODY_FIELDS.map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Textarea
                rows={2}
                value={body[key] ?? ""}
                onChange={(e) => setBody({ ...body, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
