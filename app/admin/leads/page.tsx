/**
 * Leads `/admin/leads` (PRD §8.4 / Stage 6.6).
 *
 * Status-tabbed table + detail panel with workflow, assignment, notes, export.
 */
import Link from "next/link";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { LeadsBoard } from "@/components/admin/leads/leads-board";
import { getAdminLeads } from "@/lib/admin/leads";
import { getAdminStaffOptions } from "@/lib/admin/lookups";
import { firstParam } from "@/lib/admin/serialize";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["closed", "Closed"],
  ["all", "All"],
] as const;

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const status = firstParam(searchParams.status) ?? "new";
  const [{ rows, counts }, staff] = await Promise.all([
    getAdminLeads({ status }),
    getAdminStaffOptions(),
  ]);

  const exportHref = `/api/admin/leads/export?status=${status}`;

  return (
    <>
      <PageHeader title="Leads">
        <Button asChild variant="secondary" size="sm">
          <a href={exportHref} download>
            <Download className="size-4" />
            Export CSV
          </a>
        </Button>
      </PageHeader>

      <div className="px-5 pt-5 lg:px-7">
        <div className="flex flex-wrap gap-2">
          {TABS.map(([value, label]) => {
            const active = status === value;
            const count = counts[value as keyof typeof counts];
            return (
              <Link
                key={value}
                href={`/admin/leads?status=${value}`}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  active
                    ? "bg-tint text-azure-700"
                    : "border border-border bg-surface text-text-secondary hover:border-border-strong",
                )}
              >
                {label}
                {count ? ` · ${count}` : ""}
              </Link>
            );
          })}
        </div>
      </div>

      <LeadsBoard
        rows={rows}
        staff={staff.map((s) => ({ value: s.value, label: s.label }))}
      />
    </>
  );
}
