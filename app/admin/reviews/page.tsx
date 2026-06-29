/**
 * Reviews moderation `/admin/reviews` (PRD §8.3 / Stage 6.5).
 *
 * Status-tabbed queue (default `pending`) with a master-detail moderation panel.
 */
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { ReviewsModeration } from "@/components/admin/reviews/reviews-moderation";
import { getAdminReviews } from "@/lib/admin/reviews";
import { firstParam } from "@/lib/admin/serialize";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["spam", "Spam"],
  ["all", "All"],
] as const;

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const status = firstParam(searchParams.status) ?? "pending";
  const { rows, counts } = await getAdminReviews({ status, pageSize: 100 });

  return (
    <>
      <PageHeader title="Reviews moderation">
        <div className="flex flex-wrap gap-2">
          {TABS.map(([value, label]) => {
            const active = status === value;
            const count = counts[value as keyof typeof counts];
            return (
              <Link
                key={value}
                href={`/admin/reviews?status=${value}`}
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

      <ReviewsModeration rows={rows} />
    </>
  );
}
