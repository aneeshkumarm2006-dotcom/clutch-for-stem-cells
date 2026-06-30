"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Pencil,
  Trash2,
  Search,
  Upload,
  Download,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SelectField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TableCard,
  Table,
  THead,
  Th,
  Tr,
  Td,
} from "@/components/admin/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import type { BlogAdminRow } from "@/lib/seoteam/blog-data";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  // Pin to UTC so the server-rendered date matches client hydration (this table
  // is a client component SSR'd by the force-dynamic dashboard page).
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SeoIndicator({ seo }: { seo: BlogAdminRow["seo"] }) {
  if (seo.fail > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[12.5px] text-danger">
        <XCircle className="size-3.5" /> {seo.fail} issue{seo.fail > 1 ? "s" : ""}
      </span>
    );
  }
  if (seo.warn > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[12.5px] text-warning">
        <AlertTriangle className="size-3.5" /> {seo.warn} to improve
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[12.5px] text-success">
      <CheckCircle2 className="size-3.5" /> SEO-ready
    </span>
  );
}

export function PostsTable({ initialPosts }: { initialPosts: BlogAdminRow[] }) {
  const router = useRouter();
  const [posts, setPosts] = React.useState(initialPosts);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<BlogAdminRow | null>(null);

  const filtered = posts.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (query.trim() && !p.title.toLowerCase().includes(query.trim().toLowerCase()))
      return false;
    return true;
  });

  const togglePublish = async (post: BlogAdminRow) => {
    const nextStatus = post.status === "published" ? "draft" : "published";
    setBusyId(post.id);
    try {
      await adminFetch(`/api/seoteam/posts/${post.id}`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      setPosts((cur) =>
        cur.map((p) =>
          p.id === post.id
            ? {
                ...p,
                status: nextStatus,
                publishedAt:
                  nextStatus === "published"
                    ? (p.publishedAt ?? new Date().toISOString())
                    : undefined,
              }
            : p,
        ),
      );
      toast.success(nextStatus === "published" ? "Published" : "Unpublished");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (post: BlogAdminRow) => {
    setBusyId(post.id);
    try {
      await adminFetch(`/api/seoteam/posts/${post.id}`, { method: "DELETE" });
      setPosts((cur) => cur.filter((p) => p.id !== post.id));
      toast.success("Post deleted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="pl-9"
            aria-label="Search posts"
          />
        </div>
        <div className="w-full sm:w-44">
          <SelectField
            options={[
              { value: "all", label: "All statuses" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Drafts" },
            ]}
            value={status}
            onValueChange={setStatus}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <TableCard>
          <EmptyState
            icon={FileText}
            title={posts.length === 0 ? "No posts yet" : "No matching posts"}
            description={
              posts.length === 0
                ? "Create your first SEO-optimized post to get started."
                : "Try a different search or status filter."
            }
            action={
              posts.length === 0 ? (
                <Button asChild>
                  <Link href="/seoteam/new">New post</Link>
                </Button>
              ) : undefined
            }
          />
        </TableCard>
      ) : (
        <TableCard>
          <Table>
            <THead>
              <Th>Title</Th>
              <Th className="w-28">Status</Th>
              <Th className="w-36">SEO</Th>
              <Th className="w-20 text-right">Views</Th>
              <Th className="w-28">Published</Th>
              <Th className="w-px text-right">Actions</Th>
            </THead>
            <tbody>
              {filtered.map((post) => (
                <Tr key={post.id}>
                  <Td>
                    <Link
                      href={`/seoteam/${post.id}`}
                      className="font-medium text-text-primary hover:text-primary"
                    >
                      {post.title || "Untitled"}
                    </Link>
                    <div className="text-[12px] text-text-muted">/{post.slug}</div>
                  </Td>
                  <Td>
                    <Badge
                      variant={post.status === "published" ? "success" : "neutral"}
                    >
                      {post.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </Td>
                  <Td>
                    <SeoIndicator seo={post.seo} />
                  </Td>
                  <Td className="text-right tabular-nums">{post.views}</Td>
                  <Td className="text-text-secondary">
                    {formatDate(post.publishedAt)}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {post.status === "published" ? (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          aria-label="Preview"
                          title="Preview"
                        >
                          <Link href={`/blog/${post.slug}`} target="_blank">
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Link href={`/seoteam/${post.id}`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === post.id}
                        onClick={() => togglePublish(post)}
                        title={
                          post.status === "published" ? "Unpublish" : "Publish"
                        }
                      >
                        {post.status === "published" ? (
                          <Download className="size-4" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        <span className="hidden lg:inline">
                          {post.status === "published" ? "Unpublish" : "Publish"}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete"
                        title="Delete"
                        className={cn("text-danger hover:bg-danger-bg")}
                        disabled={busyId === post.id}
                        onClick={() => setToDelete(post)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableCard>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this post?"
        description={
          toDelete
            ? `"${toDelete.title}" will be permanently removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (toDelete) await remove(toDelete);
        }}
      />
    </div>
  );
}
