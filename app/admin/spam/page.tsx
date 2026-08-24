/**
 * Blocked submissions `/admin/spam`.
 *
 * The third view in the Inbox / Spam / Blocked trio:
 *
 *   Inbox   → /admin/leads, /admin/reviews, /admin/reports (normal tabs)
 *   Spam    → the "Spam" tab in each of those (quarantined: stored, not emailed)
 *   Blocked → here (rejected: never written to the main collection at all)
 *
 * This page is the reason the filter is allowed to hard-reject anything. Every
 * rejected payload lands here verbatim for 30 days, with the exact rules that
 * produced the verdict, so a false positive is findable instead of silently
 * destroyed. Records expire on their own via the TTL index.
 */
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { BlockedBoard } from "@/components/admin/spam/blocked-board";
import { getBlockedSubmissions } from "@/lib/admin/spam";
import { firstParam } from "@/lib/admin/serialize";
import { BLOCKED_RETENTION_DAYS } from "@/config/spam";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  ["all", "All"],
  ["lead", "Leads"],
  ["review", "Reviews"],
  ["report", "Reports"],
] as const;

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminSpamPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const form = firstParam(searchParams.form) ?? "all";
  const { rows, counts } = await getBlockedSubmissions({ form, pageSize: 200 });

  return (
    <>
      <PageHeader
        title="Blocked"
        description={`Submissions the spam filter refused. Kept ${BLOCKED_RETENTION_DAYS} days, then removed automatically.`}
      >
        <div className="flex flex-wrap gap-2">
          {TABS.map(([value, label]) => {
            const active = form === value;
            const count = counts[value as keyof typeof counts];
            return (
              <Link
                key={value}
                href={`/admin/spam?form=${value}`}
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

      <BlockedBoard rows={rows} form={form} />
    </>
  );
}
