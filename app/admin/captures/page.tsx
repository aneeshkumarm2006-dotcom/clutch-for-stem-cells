/**
 * Guide signups `/admin/captures`. Editor+.
 *
 * Every address the shortlist capture modal collected, status-tabbed, with a
 * funnel strip, filters, CSV export, and a detail panel holding the full
 * context of each capture (trigger, shortlist, page, campaign, delivery).
 */
import Link from "next/link";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { CapturesBoard } from "@/components/admin/captures/captures-board";
import { getAdminCaptures } from "@/lib/admin/email-captures";
import { firstParam, parsePage } from "@/lib/admin/serialize";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  ["new", "New"],
  ["archived", "Archived"],
  ["unsubscribed", "Unsubscribed"],
  ["spam", "Spam"],
  ["all", "All"],
] as const;

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminCapturesPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const status = firstParam(searchParams.status) ?? "new";
  const trigger = firstParam(searchParams.trigger);
  const delivery = firstParam(searchParams.delivery);
  const q = firstParam(searchParams.q);
  const page = parsePage(firstParam(searchParams.page));

  const result = await getAdminCaptures({ status, trigger, delivery, q, page });

  const exportParams = new URLSearchParams({ status });
  if (trigger) exportParams.set("trigger", trigger);
  if (delivery) exportParams.set("delivery", delivery);
  if (q) exportParams.set("q", q);

  return (
    <>
      <PageHeader
        title="Guide signups"
        description="Addresses captured by the shortlist + 12 questions modal"
      >
        <Button asChild variant="secondary" size="sm">
          <a
            href={`/api/admin/email-captures/export?${exportParams.toString()}`}
            download
          >
            <Download className="size-4" />
            Export CSV
          </a>
        </Button>
      </PageHeader>

      <div className="px-5 pt-5 lg:px-7">
        <div className="flex flex-wrap gap-2">
          {TABS.map(([value, label]) => {
            const active = status === value;
            const count = result.counts[value];
            return (
              <Link
                key={value}
                href={`/admin/captures?status=${value}`}
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

      <CapturesBoard
        rows={result.rows}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        funnel={result.funnel}
        failedDeliveries={result.failedDeliveries}
        unnotified={result.unnotified}
      />
    </>
  );
}
