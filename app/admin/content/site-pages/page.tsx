/**
 * Site pages `/admin/content/site-pages` — the index of every public route whose
 * copy lives in code. Editor+.
 *
 * The homepage keeps its own screen (`/admin/content/homepage`): it has fifteen
 * bespoke sections and a feed-driven layout, which the uniform title/lead/blocks
 * form here would flatten into something worse.
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { getPageContentRows } from "@/lib/admin/page-content";
import { EDITABLE_PAGE_GROUPS } from "@/config/editable-pages";

export const dynamic = "force-dynamic";

/** Editor href for a route: `/about` → `/admin/content/site-pages/about`. */
function editHref(path: string): string {
  return `/admin/content/site-pages${path}`;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function AdminSitePagesPage() {
  await requireRole("editor", "/admin/content/site-pages");
  const rows = await getPageContentRows();

  return (
    <div>
      <PageHeader
        title="Site pages"
        description="Headline, intro, and body for every page that is not a clinic, blog post, or taxonomy term."
      />

      <div className="max-w-4xl space-y-8 p-5 lg:p-7">
        {EDITABLE_PAGE_GROUPS.map((group) => {
          const groupRows = rows.filter((r) => r.group === group);
          if (!groupRows.length) return null;

          return (
            <section key={group}>
              <h2 className="mb-3 font-display text-sm font-semibold text-text-primary">
                {group}
              </h2>
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <table className="w-full text-left text-[13.5px]">
                  <thead className="border-b border-border bg-surface-alt text-[12px] uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Page</th>
                      <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">
                        Headline
                      </th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="hidden px-4 py-2.5 font-semibold md:table-cell">
                        Last edited
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {groupRows.map((row) => (
                      <tr key={row.path} className="hover:bg-surface-alt">
                        <td className="px-4 py-3">
                          <Link
                            href={editHref(row.path)}
                            className="font-medium text-text-link hover:underline"
                          >
                            {row.label}
                          </Link>
                          <div className="text-[12px] text-text-muted">
                            {row.variantOf ?? row.path}
                          </div>
                        </td>
                        <td className="hidden max-w-xs truncate px-4 py-3 text-text-secondary sm:table-cell">
                          {row.title}
                        </td>
                        <td className="px-4 py-3">
                          {row.customized ? (
                            <Badge variant="success">Edited</Badge>
                          ) : (
                            <Badge variant="neutral">Shipped copy</Badge>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-text-muted md:table-cell">
                          {row.updatedAt
                            ? dateFormat.format(new Date(row.updatedAt))
                            : "Never"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.variantOf ? (
                            <span
                              className="text-[12px] text-text-muted"
                              title={row.variantWhen}
                            >
                              Variant
                            </span>
                          ) : (
                            <Link
                              href={row.path}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[12.5px] text-text-muted hover:text-text-secondary"
                            >
                              View
                              <ArrowUpRight className="size-3.5" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        <p className="text-[13px] text-text-muted">
          Clearing a field restores the copy the site shipped with. The landing
          page has its own screen at{" "}
          <Link
            href="/admin/content/homepage"
            className="font-medium text-text-link hover:underline"
          >
            Homepage
          </Link>
          , and meta titles and descriptions live in{" "}
          <Link
            href="/admin/seo"
            className="font-medium text-text-link hover:underline"
          >
            Page SEO
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
