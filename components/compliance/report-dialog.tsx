"use client";

/**
 * ReportDialog — public "flag for review" control (Compliance §8.7 / PRD §14).
 *
 * A small trigger (link/button) opens a dialog where a visitor can flag a
 * review or clinic with a reason + optional detail. POSTs to `/api/reports`,
 * which lands the flag in the `/admin/reports` moderation queue. No login is
 * required; the reporter's email is optional and kept private.
 */
import * as React from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TextField, TextareaField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportEntityType,
  type ReportReason,
} from "@/lib/enums";

export interface ReportDialogProps {
  entityType: ReportEntityType;
  entityId: string;
  /** What's being flagged, e.g. "this review" / a clinic name. */
  label?: string;
  className?: string;
}

export function ReportDialog({
  entityType,
  entityId,
  label,
  className,
}: ReportDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [reason, setReason] = React.useState<ReportReason | "">("");
  const [details, setDetails] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const subject = label ?? (entityType === "review" ? "this review" : "this clinic");

  function reset() {
    setReason("");
    setDetails("");
    setEmail("");
    setError(null);
    setDone(false);
  }

  async function submit() {
    setError(null);
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          reason,
          details: details.trim() || undefined,
          reporterEmail: email.trim() || undefined,
        }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      const msg = data?.error ?? "Something went wrong. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 text-[12.5px] font-medium text-text-muted transition-colors hover:text-text-secondary",
          className,
        )}
      >
        <Flag className="size-3.5" aria-hidden="true" />
        Report
      </button>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>Thanks for letting us know</DialogTitle>
              <DialogDescription>
                Our moderation team will review {subject}. We don&apos;t publish
                who submitted a report.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report {subject}</DialogTitle>
              <DialogDescription>
                Flag {subject} for our moderation team. Tell us what&apos;s wrong
                — this helps keep listings and reviews trustworthy.
              </DialogDescription>
            </DialogHeader>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[13px] font-semibold text-text-primary">
                Reason
              </legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13.5px] transition-colors",
                    reason === r
                      ? "border-azure-300 bg-tint text-azure-700"
                      : "border-border text-text-secondary hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="size-4 accent-primary"
                  />
                  {REPORT_REASON_LABELS[r]}
                </label>
              ))}
            </fieldset>

            <TextareaField
              label="Details (optional)"
              rows={3}
              placeholder="Add any context that will help us review this."
              value={details}
              maxLength={2000}
              onChange={(e) => setDetails(e.target.value)}
            />
            <TextField
              label="Your email (optional)"
              type="email"
              hint="Private — only used if we need to follow up. Never shown publicly."
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error ? (
              <p className="text-[13px] text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={submitting || !reason}>
                {submitting ? "Submitting…" : "Submit report"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
