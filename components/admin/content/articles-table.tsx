"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  Table,
  TableCard,
  TableFooter,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/admin/table";
import { ArticleStatusBadge } from "@/components/admin/status-badge";
import { RowMenu } from "@/components/admin/row-menu";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { adminFetch } from "@/lib/admin/client";
import type { AdminArticleRow } from "@/lib/admin/articles";

function fmtDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

export function ArticlesTable({
  rows,
  page,
  totalPages,
  total,
  pageSize,
}: {
  rows: AdminArticleRow[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [del, setDel] = React.useState<AdminArticleRow | null>(null);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <>
      <TableCard>
        <Table>
          <THead>
            <Th>Title</Th>
            <Th>Status</Th>
            <Th>Category</Th>
            <Th>Author</Th>
            <Th>Updated</Th>
            <Th className="w-10" />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-12 text-center text-text-muted">
                  No articles yet.
                </Td>
              </tr>
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Link
                      href={`/admin/content/articles/${r.id}`}
                      className="font-semibold text-text-primary hover:text-text-link"
                    >
                      {r.title}
                    </Link>
                  </Td>
                  <Td>
                    <ArticleStatusBadge status={r.status} />
                  </Td>
                  <Td className="text-text-secondary">{r.category ?? "—"}</Td>
                  <Td className="text-text-secondary">{r.author ?? "—"}</Td>
                  <Td className="text-text-muted">{fmtDate(r.updatedAt)}</Td>
                  <Td>
                    <RowMenu
                      label={`Actions for ${r.title}`}
                      items={[
                        {
                          label: "Edit",
                          href: `/admin/content/articles/${r.id}`,
                        },
                        {
                          label: "View public",
                          href: `/resources/${r.slug}`,
                          external: true,
                        },
                        {
                          label: "Delete",
                          destructive: true,
                          onSelect: () => setDel(r),
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
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete article"
        description={del ? `Delete "${del.title}"?` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!del) return;
          try {
            await adminFetch(`/api/admin/articles/${del.id}`, {
              method: "DELETE",
            });
            toast.success("Article deleted");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not delete.");
          }
        }}
      />
    </>
  );
}
