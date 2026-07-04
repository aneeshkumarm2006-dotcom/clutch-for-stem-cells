import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, PlusCircle } from "lucide-react";

import { getAdminMatrixPages } from "@/lib/seoteam/matrix-data";
import { MATRIX_KIND_LABELS } from "@/lib/matrix";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Combination pages · SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MatrixDashboard() {
  const pages = await getAdminMatrixPages();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">
            Combination pages
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {pages.length} page{pages.length === 1 ? "" : "s"} · treatment ×
            condition and destination guides. Only approved pages go live.
          </p>
        </div>
        <Button asChild>
          <Link href="/seoteam/matrix/new">
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
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Reviewer</th>
                <th className="px-4 py-2.5 font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pages.map((p) => (
                <tr key={p.id} className="hover:bg-surface-alt/50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/seoteam/matrix/${p.id}`}
                      className="font-medium text-text-link hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="text-[12px] text-text-muted">{p.path}</div>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {MATRIX_KIND_LABELS[p.kind]}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={
                          p.reviewStatus === "approved" ? "success" : "neutral"
                        }
                      >
                        {p.reviewStatus.replace("_", " ")}
                      </Badge>
                      {p.reviewDue ? (
                        <Badge variant="warning">Review due</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {p.hasReviewer ? "Assigned" : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.flagCount ? (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <AlertTriangle className="size-3.5" />
                        {p.flagCount}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-text-muted">
          No combination pages yet. Create one to start building the
          treatment×condition and destination matrix.
        </div>
      )}
    </div>
  );
}
