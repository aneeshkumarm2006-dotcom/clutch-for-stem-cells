"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Table,
  TableCard,
  TableFooter,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/admin/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { describeActivity, type ActivityTone } from "@/lib/admin/activity";
import { cn } from "@/lib/utils";
import type { AdminAuditRow } from "@/lib/admin/audit";

const TONE: Record<ActivityTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  info: "bg-primary",
  neutral: "bg-slate-500",
};

function fmt(iso?: string): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export function AuditTable({
  rows,
  page,
  totalPages,
  total,
  pageSize,
}: {
  rows: AdminAuditRow[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [diff, setDiff] = React.useState<AdminAuditRow | null>(null);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <>
      <TableCard>
        <Table>
          <THead>
            <Th>Action</Th>
            <Th>Entity</Th>
            <Th>Actor</Th>
            <Th>IP</Th>
            <Th>When</Th>
            <Th className="w-24" />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-12 text-center text-text-muted">
                  No audit entries.
                </Td>
              </tr>
            ) : (
              rows.map((r) => {
                const d = describeActivity(r.action);
                const hasDiff = r.before != null || r.after != null;
                return (
                  <Tr key={r.id}>
                    <Td>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn("size-2 flex-none rounded-full", TONE[d.tone])}
                        />
                        <span className="font-medium">{d.label}</span>
                        <code className="text-[11px] text-text-muted">
                          {r.action}
                        </code>
                      </span>
                    </Td>
                    <Td className="text-text-secondary">
                      {r.entityType}
                      {r.entityId ? (
                        <span className="text-text-muted"> · {r.entityId.slice(-6)}</span>
                      ) : null}
                    </Td>
                    <Td className="text-text-secondary">{r.actorName}</Td>
                    <Td className="text-text-muted">{r.ip ?? "—"}</Td>
                    <Td className="text-text-muted">{fmt(r.at)}</Td>
                    <Td>
                      {hasDiff ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDiff(r)}
                        >
                          View changes
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
        <TableFooter>
          <span>
            {total === 0 ? "No results" : `Showing ${start}–${end} of ${total}`}
          </span>
          <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
        </TableFooter>
      </TableCard>

      <Dialog open={diff !== null} onOpenChange={(o) => !o && setDiff(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {diff ? describeActivity(diff.action).label : "Changes"}
            </DialogTitle>
          </DialogHeader>
          {diff ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  Before
                </div>
                <pre className="max-h-80 overflow-auto rounded-lg bg-surface-alt p-3 text-[12px] text-slate-700">
                  {diff.before ? JSON.stringify(diff.before, null, 2) : "—"}
                </pre>
              </div>
              <div>
                <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  After
                </div>
                <pre className="max-h-80 overflow-auto rounded-lg bg-surface-alt p-3 text-[12px] text-slate-700">
                  {diff.after ? JSON.stringify(diff.after, null, 2) : "—"}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
