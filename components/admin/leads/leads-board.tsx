"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Table,
  TableCard,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/form-field";
import { LeadStatusBadge } from "@/components/admin/status-badge";
import { FilterSelect } from "@/components/admin/filter-select";
import { adminFetch } from "@/lib/admin/client";
import { cn } from "@/lib/utils";
import type { AdminLeadRow } from "@/lib/admin/leads";
import type { Option } from "@/lib/admin/lookups";

const TYPE_VARIANT: Record<string, "info" | "warning" | "success" | "neutral"> = {
  consultation: "info",
  match: "warning",
  quote: "success",
  message: "neutral",
};

const TIMEFRAME: Record<string, string> = {
  asap: "ASAP",
  "1-3mo": "1–3 months",
  "3-6mo": "3–6 months",
  researching: "Researching",
};

const WORKFLOW = ["new", "contacted", "qualified", "closed"] as const;

function relTime(iso?: string): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function LeadsBoard({
  rows,
  staff,
}: {
  rows: AdminLeadRow[];
  staff: Option[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState(rows[0]?.id ?? null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const patch = async (body: Record<string, unknown>, msg: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/leads/${selected.id}`, {
        method: "PATCH",
        body,
      });
      toast.success(msg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-0 lg:flex-row">
      <div className="min-w-0 flex-1 p-5 lg:p-7">
        <TableCard>
          <Table>
            <THead>
              <Th>Type</Th>
              <Th>Contact</Th>
              <Th>Clinic / match</Th>
              <Th>Condition</Th>
              <Th>Status</Th>
              <Th>Source</Th>
              <Th>Date</Th>
            </THead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="py-12 text-center text-text-muted">
                    No leads in this view.
                  </Td>
                </tr>
              ) : (
                rows.map((r) => (
                  <Tr
                    key={r.id}
                    interactive
                    selected={r.id === selected?.id}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <Td>
                      <Badge variant={TYPE_VARIANT[r.type] ?? "neutral"}>
                        {r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                      </Badge>
                    </Td>
                    <Td className="font-semibold">{r.name}</Td>
                    <Td className="text-text-secondary">
                      {r.clinicName ??
                        (r.matchedCount ? `${r.matchedCount} clinics` : "—")}
                    </Td>
                    <Td className="text-text-secondary">
                      {r.conditionName ?? "—"}
                    </Td>
                    <Td>
                      <LeadStatusBadge status={r.status} />
                    </Td>
                    <Td className="text-text-muted">{r.source ?? "—"}</Td>
                    <Td className="text-text-muted">{relTime(r.createdAt)}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableCard>
      </div>

      {/* Detail */}
      {selected ? (
        <aside className="w-full flex-none border-t border-border bg-surface p-6 lg:max-h-[calc(100vh-4rem)] lg:w-[360px] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="mb-4 flex items-center justify-between">
            <Badge variant={TYPE_VARIANT[selected.type] ?? "neutral"}>
              {selected.type.charAt(0).toUpperCase() + selected.type.slice(1)}
            </Badge>
            <span className="text-xs text-text-muted">
              {relTime(selected.createdAt)}
            </span>
          </div>
          <h2 className="font-display text-lg font-bold">{selected.name}</h2>
          <div className="mb-4 break-words text-[13px] text-text-secondary">
            {[selected.email, selected.phone, selected.country]
              .filter(Boolean)
              .join(" · ")}
          </div>

          <dl className="mb-4 grid gap-2.5 border-t border-slate-100 pt-4 text-[13px]">
            {selected.clinicName ? (
              <Row label="Clinic" value={selected.clinicName} />
            ) : null}
            {selected.matchedCount ? (
              <Row label="Matched" value={`${selected.matchedCount} clinics`} />
            ) : null}
            {selected.conditionName ? (
              <Row label="Condition" value={selected.conditionName} />
            ) : null}
            {selected.treatmentNames.length ? (
              <Row label="Treatment" value={selected.treatmentNames.join(", ")} />
            ) : null}
            {selected.budgetRange ? (
              <Row label="Budget" value={selected.budgetRange} />
            ) : null}
            {selected.timeframe ? (
              <Row
                label="Timeframe"
                value={TIMEFRAME[selected.timeframe] ?? selected.timeframe}
              />
            ) : null}
          </dl>

          {selected.message ? (
            <div className="mb-4 rounded-lg bg-surface-alt px-3.5 py-3 text-[13px] leading-relaxed text-slate-700">
              “{selected.message}”
            </div>
          ) : null}

          <Label className="mb-2 block">Status</Label>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {WORKFLOW.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => patch({ status: s }, "Status updated")}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold capitalize",
                  selected.status === s
                    ? "border-azure-300 bg-tint text-azure-700"
                    : "border-border text-text-secondary hover:border-border-strong",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <Label className="mb-2 block">Assigned to</Label>
            <FilterSelect
              value={selected.assignedToId}
              onChange={(v) =>
                patch({ assignedTo: v ?? null }, "Assignment updated")
              }
              options={staff}
              allLabel="Unassigned"
            />
          </div>

          <Label className="mb-2 block">Internal notes</Label>
          <div className="mb-2 space-y-2">
            {selected.internalNotes.length === 0 ? (
              <p className="text-[12.5px] text-text-muted">No notes yet.</p>
            ) : (
              selected.internalNotes.map((n, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-surface-alt px-3 py-2 text-[12.5px] text-slate-700"
                >
                  {n.note}
                  <span className="mt-1 block text-text-muted">
                    — {n.byName ?? "Admin"}
                    {n.at ? ` · ${relTime(n.at)}` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Add an internal note"
            className="mb-2"
          />
          <Button
            size="sm"
            className="w-full"
            disabled={busy || !note.trim()}
            onClick={async () => {
              await patch({ note }, "Note added");
              setNote("");
            }}
          >
            Save note
          </Button>
        </aside>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-text-primary">{value}</dd>
    </div>
  );
}
