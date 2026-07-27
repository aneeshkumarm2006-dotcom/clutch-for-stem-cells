import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, PlusCircle } from "lucide-react";

import { getAdminPages } from "@/lib/seoteam/page-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Pages | SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PagesDashboard() {
  const pages = await getAdminPages();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">
            Pages
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {pages.length} page{pages.length === 1 ? "" : "s"} · composed from
            reusable content blocks. Only approved pages go live.
          </p>
        </div>
        <Button asChild>
          <Link href="/seoteam/pages/new">
            <PlusCircle className="size-4" />
            New page
          </Link>
        </Button>
      </div>

      {pages.length ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt text-left text-[12px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Title</th>
                <th className="px-4 py-2.5 font-semibold">Blocks</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pages.map((p) => (
                <tr key={p.id} className="hover:bg-surface-alt/50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/seoteam/pages/${p.id}`}
                      className="font-medium text-text-link hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="text-[12px] text-text-muted">{p.path}</div>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {p.blockCount}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={
                        p.reviewStatus === "approved" ? "success" : "neutral"
                      }
                    >
                      {p.reviewStatus.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {p.flagCount ? (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <AlertTriangle className="size-3.5" />
                        {p.flagCount}
                      </span>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-text-muted">
          No pages yet. Create one to compose a page from content blocks.
        </div>
      )}
    </div>
  );
}
