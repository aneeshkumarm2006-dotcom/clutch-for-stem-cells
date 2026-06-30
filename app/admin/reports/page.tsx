/**
 * Reports moderation `/admin/reports` (PRD §14 / Stage 8.7).
 *
 * Status-tabbed queue (default `open`) of user-submitted flags on reviews and
 * clinics, with a master-detail triage panel. Editor+.
 */
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { ReportsManager } from "@/components/admin/reports/reports-manager";
import { getAdminReports } from "@/lib/admin/reports";
import { firstParam } from "@/lib/admin/serialize";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  ["open", "Open"],
  ["reviewing", "Reviewing"],
  ["resolved", "Resolved"],
  ["dismissed", "Dismissed"],
  ["all", "All"],
] as const;

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const status = firstParam(searchParams.status) ?? "open";
  const { rows, counts } = await getAdminReports({ status, pageSize: 100 });

  return (
    <>
      <PageHeader
        title="Reports"
        description="User-submitted flags on reviews and clinics"
      >
        <div className="flex flex-wrap gap-2">
          {TABS.map(([value, label]) => {
            const active = status === value;
            const count = counts[value as keyof typeof counts];
            return (
              <Link
                key={value}
                href={`/admin/reports?status=${value}`}
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
      </PageHeader>

      <ReportsManager rows={rows} />
    </>
  );
}
