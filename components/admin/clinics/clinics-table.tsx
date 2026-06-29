"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableCard,
  TableFooter,
  Td,
  Th,
  Tr,
} from "@/components/admin/table";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import {
  ClinicStatusBadge,
  ClinicTierBadge,
} from "@/components/admin/status-badge";
import { RowMenu } from "@/components/admin/row-menu";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminFetch } from "@/lib/admin/client";
import { cn } from "@/lib/utils";
import type { AdminClinicRow } from "@/lib/admin/clinics";

function relTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function SortTh({
  label,
  field,
  className,
}: {
  label: string;
  field: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("sort") ?? "updated_desc";
  const active = current.startsWith(field + "_");
  const dir = active && current.endsWith("_asc") ? "asc" : "desc";

  const toggle = () => {
    const next = active && dir === "desc" ? `${field}_asc` : `${field}_desc`;
    const params = new URLSearchParams(sp.toString());
    params.set("sort", next);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Th className={className}>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 hover:text-text-primary"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : null}
      </button>
    </Th>
  );
}

function CheckBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "inline-flex size-4 items-center justify-center rounded border",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border-strong",
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}

export function ClinicsTable({
  rows,
  page,
  totalPages,
  total,
  pageSize,
}: {
  rows: AdminClinicRow[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<{
    ids: string[];
  } | null>(null);

  // Drop selections that are no longer on the page (after refresh/navigation).
  React.useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ids = [...selected];

  const runBulk = async (
    action: string,
    value?: string,
    targetIds: string[] = ids,
  ) => {
    if (targetIds.length === 0) return;
    setBusy(true);
    try {
      const res = await adminFetch<{ count: number }>(
        "/api/admin/clinics/bulk",
        { method: "POST", body: { ids: targetIds, action, value } },
      );
      toast.success(`${res.count} clinic${res.count === 1 ? "" : "s"} updated`);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <>
      {ids.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-azure-300 bg-tint px-4 py-2.5">
          <span className="text-[13px] font-semibold text-azure-700">
            {ids.length} selected
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => runBulk("publish")}>
              Publish
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => runBulk("unpublish")}>
              Unpublish
            </Button>
            <Select onValueChange={(v) => runBulk("setTier", v)}>
              <SelectTrigger className="h-8 w-auto gap-2 text-[13px]">
                <SelectValue placeholder="Set tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => runBulk("verify")}>
              Verify
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirmDelete({ ids })}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : null}

      <TableCard>
        <Table>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              <Th className="w-9">
                <CheckBox
                  checked={allOnPage}
                  onChange={toggleAll}
                  label="Select all on page"
                />
              </Th>
              <SortTh label="Clinic" field="name" />
              <Th>Status</Th>
              <Th>Tier</Th>
              <SortTh label="Rating" field="rating" />
              <SortTh label="Reviews" field="reviews" />
              <Th>Location</Th>
              <SortTh label="Updated" field="updated" />
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={9} className="py-12 text-center text-text-muted">
                  No clinics match these filters.
                </Td>
              </tr>
            ) : (
              rows.map((r) => (
                <Tr key={r.id} selected={selected.has(r.id)}>
                  <Td>
                    <CheckBox
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      label={`Select ${r.name}`}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar
                        name={r.name}
                        initials={r.initials}
                        src={r.logoUrl}
                      />
                      <Link
                        href={`/admin/clinics/${r.id}`}
                        className="font-semibold text-text-primary hover:text-text-link"
                      >
                        {r.name}
                      </Link>
                      {r.isDeleted ? (
                        <span className="text-[11px] font-semibold text-danger">
                          deleted
                        </span>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    <ClinicStatusBadge status={r.status} />
                  </Td>
                  <Td>
                    <ClinicTierBadge tier={r.tier} />
                  </Td>
                  <Td className="font-semibold">
                    {r.reviewCount > 0 ? r.ratingAvg.toFixed(1) : "—"}
                  </Td>
                  <Td className="text-text-secondary">{r.reviewCount}</Td>
                  <Td className="text-text-secondary">{r.location}</Td>
                  <Td className="text-text-muted">{relTime(r.updatedAt)}</Td>
                  <Td>
                    <RowMenu
                      label={`Actions for ${r.name}`}
                      items={[
                        { label: "Edit", href: `/admin/clinics/${r.id}` },
                        {
                          label: "View public profile",
                          href: `/clinic/${r.slug}`,
                          external: true,
                        },
                        r.isDeleted
                          ? {
                              label: "Restore",
                              onSelect: () => runBulk("restore", undefined, [r.id]),
                            }
                          : {
                              label: "Delete",
                              destructive: true,
                              onSelect: () => setConfirmDelete({ ids: [r.id] }),
                            },
                      ]}
                    />
                  </Td>
                </Tr>
              ))
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

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete clinic"
        description={
          confirmDelete && confirmDelete.ids.length > 1
            ? `Soft-delete ${confirmDelete.ids.length} clinics? They can be restored later.`
            : "Soft-delete this clinic? It can be restored later."
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (confirmDelete) await runBulk("delete", undefined, confirmDelete.ids);
        }}
      />
    </>
  );
}
