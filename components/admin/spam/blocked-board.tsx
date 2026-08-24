"use client";

/**
 * Blocked-submission list for `/admin/spam`.
 *
 * Each row shows the whole rejected payload plus every rule that fired. That
 * verbosity is the point: this is the only surviving copy of a hard-rejected
 * submission, so an operator has to be able to read it and decide the machine
 * was wrong — which they can't do from a score alone.
 *
 * Payload values are attacker-controlled text. They are rendered as React
 * children (escaped) and never through `dangerouslySetInnerHTML`.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import type { AdminBlockedRow } from "@/lib/admin/spam";

/** Wire fields the guard adds — noise in a payload dump, so they're hidden. */
const HIDDEN_KEYS = new Set(["captchaToken", "hp", "elapsedMs"]);

function relTime(iso?: string): string {
  if (!iso) return "–";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function BlockedBoard({
  rows,
  form,
}: {
  rows: AdminBlockedRow[];
  form: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [purgeOpen, setPurgeOpen] = React.useState(false);

  async function remove(id: string) {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/spam?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      toast.success("Removed");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    setBusy(true);
    try {
      const res = await adminFetch<{ deleted: number }>(
        `/api/admin/spam?form=${encodeURIComponent(form)}`,
        { method: "DELETE" },
      );
      toast.success(`Purged ${res.deleted} blocked submissions`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setPurgeOpen(false);
    }
  }

  if (!rows.length) {
    return (
      <div className="px-5 py-16 text-center lg:px-7">
        <p className="text-sm text-text-secondary">
          Nothing blocked. Submissions the filter rejects outright appear here
          with the reasons that produced the verdict.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-5 lg:px-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-text-secondary">
          {rows.length} blocked submission{rows.length === 1 ? "" : "s"}. If one
          of these is a real enquiry, the rule that caught it is wrong — copy the
          message into the GENUINE block of{" "}
          <code className="rounded bg-surface-alt px-1 py-0.5 text-[12px]">
            tests/spam/classify.test.ts
          </code>{" "}
          and narrow the rule until it passes.
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => setPurgeOpen(true)}
        >
          <Trash2 className="size-4" />
          Purge this view
        </Button>
      </div>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="rounded bg-danger-bg px-1.5 py-0.5 font-semibold uppercase tracking-wide text-danger-fg">
                {row.category ?? "blocked"}
              </span>
              <span className="rounded bg-surface-alt px-1.5 py-0.5 font-medium capitalize text-text-secondary">
                {row.form}
              </span>
              <span className="text-text-muted">score {row.score}</span>
              <span className="text-text-muted">{relTime(row.createdAt)}</span>
              {row.ip ? (
                <span className="text-text-muted">
                  {row.ip}
                  {row.subnet ? ` (${row.subnet})` : ""}
                </span>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(row.id)}
                className="ml-auto text-text-muted underline underline-offset-2 hover:text-danger"
              >
                Delete
              </button>
            </div>

            <dl className="mb-3 grid gap-1.5 text-[13px]">
              {Object.entries(row.payload)
                .filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== "" && v != null)
                .map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="w-28 shrink-0 text-text-muted">{key}</dt>
                    <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-slate-700">
                      {renderValue(value)}
                    </dd>
                  </div>
                ))}
            </dl>

            <ul className="space-y-1 border-t border-slate-100 pt-2.5 text-[12.5px] leading-relaxed text-text-secondary">
              {row.reasons.map((r) => (
                <li key={r.code} className="flex gap-1.5">
                  <span className="text-text-muted">+{r.weight}</span>
                  <span>{r.detail}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
        destructive
        title="Purge blocked submissions?"
        description={`This permanently deletes every blocked submission in the "${form}" view. It is the only copy — anything wrongly blocked is gone for good. They expire on their own after 30 days, so purging is rarely necessary.`}
        confirmLabel="Purge"
        onConfirm={purge}
      />
    </div>
  );
}
