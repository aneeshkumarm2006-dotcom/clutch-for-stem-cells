/**
 * Articles list `/admin/content/articles` (PRD §8.6 / Stage 6.8).
 */
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { ListSearch } from "@/components/admin/list-search";
import { ArticlesTable } from "@/components/admin/content/articles-table";
import { getAdminArticles } from "@/lib/admin/articles";
import { firstParam, parsePage } from "@/lib/admin/serialize";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  ["all", "All"],
  ["published", "Published"],
  ["draft", "Draft"],
  ["scheduled", "Scheduled"],
] as const;

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const status = firstParam(searchParams.status) ?? "all";
  const data = await getAdminArticles({
    status,
    q: firstParam(searchParams.q),
    page: parsePage(firstParam(searchParams.page)),
  });

  return (
    <>
      <PageHeader title="Articles">
        <Button asChild size="sm">
          <Link href="/admin/content/articles/new">
            <Plus className="size-4" />
            New article
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-3.5 p-5 lg:p-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <ListSearch placeholder="Search articles" />
          <div className="flex flex-wrap gap-2">
            {TABS.map(([value, label]) => {
              const active = status === value;
              const count = data.counts[value];
              return (
                <Link
                  key={value}
                  href={`/admin/content/articles?status=${value}`}
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
        <ArticlesTable
          rows={data.rows}
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
        />
      </div>
    </>
  );
}
