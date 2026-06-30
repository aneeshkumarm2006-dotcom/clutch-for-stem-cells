"use client";

/**
 * ReportsManager — moderation queue for user-submitted flags (Stage 8.7).
 *
 * Master-detail like the reviews queue: a list of flags on the left, the
 * selected flag's context + triage actions on the right. Actions PATCH
 * `/api/admin/reports/[id]` to move a flag through open → reviewing →
 * resolved/dismissed. The flagged review/clinic is actioned from its own module
 * via the "Open target" link.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Flag } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ReportStatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import { REPORT_REASON_LABELS } from "@/lib/enums";
import type { AdminReportRow } from "@/lib/admin/reports";

function formatDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export function ReportsManager({ rows }: { rows: AdminReportRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState(rows[0]?.id ?? null);
  const [busy, setBusy] = React.useState(false);
  const [resolve, setResolve] = React.useState(false);
  const [dismiss, setDismiss] = React.useState(false);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const act = async (
    id: string,
    body: { status: string; resolutionNote?: string },
    okMsg: string,
  ) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/reports/${id}`, { method: "PATCH", body });
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
        No reports in this view.
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
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Flag className="size-3.5 text-text-muted" aria-hidden="true" />
                  {r.entityType === "review" ? "Review" : "Clinic"} flag
                </div>
                <div className="truncate text-xs text-text-muted">
                  {REPORT_REASON_LABELS[r.reason]}
                  {r.clinicName ? ` · ${r.clinicName}` : ""}
                </div>
              </div>
              <ReportStatusBadge status={r.status} />
            </div>
            {r.details ? (
              <p className="line-clamp-2 text-[13px] text-text-secondary">
                {r.details}
              </p>
            ) : null}
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
                  {selected.entityType === "review" ? "Review" : "Clinic"} reported
                </div>
                <div className="text-[12.5px] text-text-muted">
                  {REPORT_REASON_LABELS[selected.reason]} ·{" "}
                  {formatDate(selected.submittedAt)}
                </div>
              </div>
              <ReportStatusBadge status={selected.status} />
            </div>

            {/* Target context */}
            <div className="mb-4 rounded-lg bg-surface-alt p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-azure-700">
                {selected.entityType === "review" ? "Flagged review" : "Flagged clinic"}
              </div>
              <div className="mt-1.5 text-[13.5px] text-text-secondary">
                {selected.clinicName ? (
                  <span className="font-medium text-text-primary">
                    {selected.clinicName}
                  </span>
                ) : (
                  <span className="text-text-muted">Target unavailable</span>
                )}
                {selected.entityType === "review" && selected.reviewSnippet ? (
                  <p className="mt-1.5 italic text-text-secondary">
                    “{selected.reviewSnippet}”
                  </p>
                ) : null}
                {selected.entityType === "review" && selected.reviewStatus ? (
                  <p className="mt-1 text-[12px] text-text-muted">
                    Review status: {selected.reviewStatus}
                  </p>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.targetHref ? (
                  <Button size="sm" variant="secondary" asChild>
                    <a
                      href={selected.targetHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      View on site
                    </a>
                  </Button>
                ) : null}
                {selected.entityType === "review" ? (
                  <Button size="sm" variant="secondary" asChild>
                    <Link href="/admin/reviews">Moderate reviews</Link>
                  </Button>
                ) : selected.clinicId ? (
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/admin/clinics/${selected.clinicId}`}>
                      Edit clinic
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            {selected.details ? (
              <div className="mb-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Reporter notes
                </div>
                <p className="text-[13.5px] leading-relaxed text-slate-700">
                  {selected.details}
                </p>
              </div>
            ) : null}

            <div className="mb-4 text-[12.5px] text-text-muted">
              Reporter:{" "}
              {selected.reporterEmail
                ? `${selected.reporterEmail} (private)`
                : "anonymous"}
            </div>

            {selected.resolutionNote ? (
              <div className="mb-4 rounded-lg bg-surface-alt px-3 py-2 text-[12.5px] text-text-secondary">
                Resolution: {selected.resolutionNote}
              </div>
            ) : null}

            {/* Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
              {selected.status === "open" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    act(selected.id, { status: "reviewing" }, "Marked as reviewing")
                  }
                >
                  Start review
                </Button>
              ) : null}
              {selected.status !== "resolved" ? (
                <Button
                  size="sm"
                  className="bg-success hover:brightness-95"
                  disabled={busy}
                  onClick={() => setResolve(true)}
                >
                  Resolve…
                </Button>
              ) : null}
              {selected.status !== "dismissed" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setDismiss(true)}
                >
                  Dismiss…
                </Button>
              ) : null}
              {selected.status !== "open" &&
              selected.status !== "reviewing" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={busy}
                  onClick={() =>
                    act(selected.id, { status: "open" }, "Reopened")
                  }
                >
                  Reopen
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <>
          <ConfirmDialog
            open={resolve}
            onOpenChange={setResolve}
            title="Resolve report"
            description="Mark this flag as actioned. Add an internal note on what you did."
            confirmLabel="Resolve"
            withReason
            reasonLabel="Resolution note (optional)"
            onConfirm={(note) =>
              act(
                selected.id,
                { status: "resolved", resolutionNote: note },
                "Report resolved",
              )
            }
          />
          <ConfirmDialog
            open={dismiss}
            onOpenChange={setDismiss}
            title="Dismiss report"
            description="Dismiss this flag as not actionable (e.g. no policy violation)."
            confirmLabel="Dismiss"
            withReason
            reasonLabel="Reason (optional)"
            onConfirm={(note) =>
              act(
                selected.id,
                { status: "dismissed", resolutionNote: note },
                "Report dismissed",
              )
            }
          />
        </>
      ) : null}
    </div>
  );
}
