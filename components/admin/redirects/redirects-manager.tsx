"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import type { RedirectRow } from "@/lib/admin/redirects";

const selectClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-border-strong";

/**
 * Redirects manager — record a 301/302 when content moves so the old URL keeps
 * its link equity instead of 404ing.
 *
 * Renaming a page in the CMS already records its redirect automatically; this
 * screen is for everything else (a URL that moved before this system existed, an
 * external campaign link, a consolidation).
 */
export function RedirectsManager({ redirects }: { redirects: RedirectRow[] }) {
  const router = useRouter();
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [statusCode, setStatusCode] = React.useState<301 | 302>(301);
  const [saving, setSaving] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<RedirectRow | null>(
    null,
  );

  const create = async () => {
    if (!from.trim() || !to.trim()) {
      return toast.error("Both a source and a destination are required.");
    }
    setSaving(true);
    try {
      await adminFetch("/api/admin/redirects", {
        method: "POST",
        body: { from: from.trim(), to: to.trim(), statusCode },
      });
      toast.success("Redirect created");
      setFrom("");
      setTo("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await adminFetch(`/api/admin/redirects/${id}`, { method: "DELETE" });
      toast.success("Redirect deleted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  return (
    <>
      <PageHeader title="Redirects" />

      <div className="max-w-3xl space-y-5 p-5 lg:p-7">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="mb-3 font-display text-sm font-semibold text-text-primary">
            Add a redirect
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="redirect-from">From</Label>
              <Input
                id="redirect-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="/old-page"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="redirect-to">To</Label>
              <Input
                id="redirect-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="/new-page"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="redirect-status">Type</Label>
              <select
                id="redirect-status"
                className={selectClass}
                value={statusCode}
                onChange={(e) =>
                  setStatusCode(Number(e.target.value) as 301 | 302)
                }
              >
                <option value={301}>301 permanent</option>
                <option value={302}>302 temporary</option>
              </select>
            </div>
          </div>
          <Button className="mt-3" onClick={create} disabled={saving}>
            <Plus className="size-4" />
            {saving ? "Saving…" : "Add redirect"}
          </Button>
          <p className="mt-2 text-[12.5px] text-text-muted">
            Redirects fire when a URL no longer resolves. A live page always wins
            over a redirect pointing at it.
          </p>
        </div>

        {redirects.length ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-alt text-left text-[12px] uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">From</th>
                  <th className="px-4 py-2.5 font-semibold">To</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Hits</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {redirects.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-alt/50">
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-text-primary">
                      {r.from}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-text-secondary">
                      {r.to}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={r.statusCode === 301 ? "success" : "neutral"}
                      >
                        {r.statusCode}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{r.hits}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Delete redirect from ${r.from}`}
                        onClick={() => setPendingDelete(r)}
                        className="rounded-md p-1.5 text-text-muted hover:bg-surface-alt hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-text-muted">
            No redirects yet.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this redirect?"
        description={
          pendingDelete
            ? `${pendingDelete.from} will start returning 404 again.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (pendingDelete) await remove(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
