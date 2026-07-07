"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Upload,
  Copy,
  Pencil,
  Trash2,
  Link2,
  ScanLine,
  Search,
  X,
  Check,
  ExternalLink,
  FolderInput,
  Loader2,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { SeoMediaResult, SeoMediaRow } from "@/lib/seoteam/media-data";

const ALL_FOLDERS = "__all__";

export function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Parse and dedupe a textarea of URLs (one per line). */
async function seoFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    throw new Error(
      (payload as { error?: string } | null)?.error ?? "Request failed.",
    );
  }
  return payload as T;
}

export function MediaManager({ data }: { data: SeoMediaResult }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const rows = data.rows;

  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<SeoMediaRow | null>(null);
  const [detailFor, setDetailFor] = React.useState<SeoMediaRow | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<SeoMediaRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [moveFolder, setMoveFolder] = React.useState("");

  // ── URL-driven filters ──────────────────────────────────────────────────────
  const setParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const currentFolder = sp.get("folder") ?? "blog";
  const currentSort = sp.get("sort") ?? "newest";
  const unusedOnly = sp.get("filter") === "unused";

  // Debounced search.
  const [term, setTerm] = React.useState(sp.get("q") ?? "");
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(() => setParams({ q: term || undefined }), 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  // Drop selections no longer on the page after a refresh.
  React.useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(rows.map((r) => r.id));
      const next = new Set<string>();
      let changed = false;
      prev.forEach((id) => (ids.has(id) ? next.add(id) : (changed = true)));
      return changed ? next : prev;
    });
  }, [rows]);

  // ── Selection ───────────────────────────────────────────────────────────────
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedInUse = rows.filter(
    (r) => selected.has(r.id) && r.usageCount > 0,
  ).length;

  // ── Mutations ───────────────────────────────────────────────────────────────
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const file of Array.from(files)) form.append("file", file);
      const res = await seoFetch<{ uploaded: number }>("/api/seoteam/media", {
        method: "POST",
        body: form,
      });
      toast.success(`Uploaded ${res.uploaded} image${res.uploaded === 1 ? "" : "s"}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const scan = async () => {
    setScanning(true);
    try {
      const res = await seoFetch<{ imported: number }>(
        "/api/seoteam/media/scan",
        { method: "POST" },
      );
      toast.success(
        res.imported > 0
          ? `Imported ${res.imported} image${res.imported === 1 ? "" : "s"} from posts`
          : "No new images found in posts",
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const runBulk = async (action: "delete" | "setFolder", value?: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      const res = await seoFetch<{ count: number }>("/api/seoteam/media/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, value }),
      });
      toast.success(
        action === "delete"
          ? `Deleted ${res.count} image${res.count === 1 ? "" : "s"}`
          : `Moved ${res.count} image${res.count === 1 ? "" : "s"}`,
      );
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  };

  const deleteOne = async (row: SeoMediaRow) => {
    try {
      await seoFetch(`/api/seoteam/media/${row.id}`, { method: "DELETE" });
      toast.success("Deleted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const folderOptions = Array.from(
    new Set(["blog", ...data.folders]),
  );

  const start = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.total);

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by name or alt text"
            className="pl-9"
          />
        </div>

        <Select
          value={currentFolder}
          onValueChange={(v) =>
            setParams({ folder: v === "blog" ? undefined : v })
          }
        >
          <SelectTrigger className="w-auto min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FOLDERS}>All folders</SelectItem>
            {folderOptions.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentSort}
          onValueChange={(v) =>
            setParams({ sort: v === "newest" ? undefined : v })
          }
        >
          <SelectTrigger className="w-auto min-w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Largest</SelectItem>
            <SelectItem value="usage">Most used</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant={unusedOnly ? "primary" : "secondary"}
          onClick={() => setParams({ filter: unusedOnly ? undefined : "unused" })}
        >
          <ImageOff className="size-4" />
          Unused only
        </Button>
      </div>

      {/* Actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Upload className="size-4" /> Upload images
            </>
          )}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
          <Link2 className="size-4" /> Import from URLs
        </Button>
        <Button size="sm" variant="secondary" onClick={scan} disabled={scanning}>
          {scanning ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <ScanLine className="size-4" /> Scan posts for images
            </>
          )}
        </Button>

        {rows.length > 0 ? (
          <button
            type="button"
            onClick={toggleAll}
            className="ml-auto text-[13px] text-text-link hover:underline"
          >
            {allOnPage ? "Deselect all" : "Select all"}
          </button>
        ) : null}
      </div>

      {/* Grid */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface p-12 text-center text-sm text-text-muted">
          {unusedOnly
            ? "No unused images — every image here is attached to a post."
            : "No images yet. Upload some, import URLs, or scan your posts."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((m) => {
            const isSelected = selected.has(m.id);
            return (
              <div
                key={m.id}
                className={cn(
                  "group overflow-hidden rounded-xl border bg-surface transition-colors",
                  isSelected ? "border-primary ring-1 ring-primary" : "border-border",
                )}
              >
                <div
                  className="relative aspect-square cursor-pointer bg-surface-alt"
                  onClick={() => setDetailFor(m)}
                >
                  <Image
                    src={m.url}
                    alt={m.alt ?? ""}
                    fill
                    sizes="200px"
                    className="object-cover"
                    unoptimized
                  />

                  {/* Selection checkbox */}
                  <button
                    type="button"
                    aria-label={isSelected ? "Deselect" : "Select"}
                    aria-pressed={isSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOne(m.id);
                    }}
                    className={cn(
                      "absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded border bg-white/90 text-ink transition-opacity",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground opacity-100"
                        : "border-border opacity-0 group-hover:opacity-100",
                    )}
                  >
                    {isSelected ? <Check className="size-3.5" /> : null}
                  </button>

                  {/* Usage badge */}
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      m.usageCount > 0
                        ? "bg-ink/75 text-white"
                        : "bg-ink/40 text-white",
                    )}
                  >
                    {m.usageCount > 0 ? `Used ${m.usageCount}` : "Unused"}
                  </span>

                  {/* Hover actions */}
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-ink/55 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard?.writeText(m.url);
                        toast.success("URL copied");
                      }}
                      className="rounded p-1 text-white hover:bg-white/20"
                      aria-label="Copy URL"
                    >
                      <Copy className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(m);
                      }}
                      className="rounded p-1 text-white hover:bg-white/20"
                      aria-label="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteFor(m);
                      }}
                      className="rounded p-1 text-white hover:bg-white/20"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <div className="truncate text-[12px] font-medium text-text-primary">
                    {m.filename ?? m.alt ?? "Image"}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {[
                      m.width && m.height ? `${m.width}×${m.height}` : null,
                      fmtSize(m.bytes),
                      m.folder,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between text-[13px] text-text-muted">
          <span>{`Showing ${start}–${end} of ${data.total}`}</span>
          <Pagination page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
        </div>
      ) : null}

      {/* Bulk action bar */}
      {selected.size > 0 ? (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <span className="text-sm font-medium text-text-primary">
            {selected.size} selected
            {selectedInUse > 0 ? (
              <span className="ml-1 text-text-muted">
                · {selectedInUse} in use
              </span>
            ) : null}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={moveFolder} onValueChange={setMoveFolder}>
              <SelectTrigger className="h-9 w-auto min-w-[130px]">
                <SelectValue placeholder="Move to folder…" />
              </SelectTrigger>
              <SelectContent>
                {folderOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!moveFolder}
              onClick={() => runBulk("setFolder", moveFolder)}
            >
              <FolderInput className="size-4" /> Move
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="size-4" /> Clear
            </Button>
          </div>
        </div>
      ) : null}

      {/* Detail dialog */}
      <DetailDialog
        media={detailFor}
        onOpenChange={(o) => !o && setDetailFor(null)}
        onEdit={(m) => {
          setDetailFor(null);
          setEditing(m);
        }}
      />

      {/* Edit dialog */}
      <EditDialog
        media={editing}
        folders={folderOptions}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => router.refresh()}
      />

      {/* Single delete */}
      <ConfirmDialog
        open={deleteFor !== null}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        title="Delete image"
        description={
          deleteFor && deleteFor.usageCount > 0
            ? `This image is used in ${deleteFor.usageCount} post${deleteFor.usageCount === 1 ? "" : "s"} — those images will break. Delete anyway?`
            : "Delete this image from the library and storage?"
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleteFor) await deleteOne(deleteFor);
        }}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} image${selected.size === 1 ? "" : "s"}`}
        description={
          selectedInUse > 0
            ? `${selectedInUse} of these ${selected.size === 1 ? "is" : "are"} used in posts — those images will break. Delete anyway?`
            : "Delete the selected images from the library and storage?"
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await runBulk("delete");
        }}
      />

      {/* Import from URLs */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => router.refresh()}
      />
    </>
  );
}

// ── Detail dialog ──────────────────────────────────────────────────────────────

function DetailDialog({
  media,
  onOpenChange,
  onEdit,
}: {
  media: SeoMediaRow | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (media: SeoMediaRow) => void;
}) {
  return (
    <Dialog open={media !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {media?.filename ?? media?.alt ?? "Image"}
          </DialogTitle>
        </DialogHeader>
        {media ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-alt">
              <Image
                src={media.url}
                alt={media.alt ?? ""}
                fill
                sizes="320px"
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="min-w-0 space-y-3 text-sm">
              <dl className="space-y-1.5">
                <Meta label="Dimensions">
                  {media.width && media.height
                    ? `${media.width}×${media.height}`
                    : "—"}
                </Meta>
                <Meta label="Size">{fmtSize(media.bytes) || "—"}</Meta>
                <Meta label="Folder">{media.folder ?? "—"}</Meta>
                <Meta label="Format">{media.format ?? "—"}</Meta>
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard?.writeText(media.url);
                    toast.success("URL copied");
                  }}
                >
                  <Copy className="size-4" /> Copy URL
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onEdit(media)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={media.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Open
                  </a>
                </Button>
              </div>

              <div>
                <div className="mb-1.5 text-[13px] font-semibold text-text-primary">
                  Used in {media.usageCount} post
                  {media.usageCount === 1 ? "" : "s"}
                </div>
                {media.usedIn.length === 0 ? (
                  <p className="text-[13px] text-text-muted">
                    Not attached to any post yet.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {media.usedIn.map((ref) => (
                      <li key={`${ref.postId}-${ref.where}`}>
                        <Link
                          href={`/seoteam/${ref.postId}`}
                          className="inline-flex items-center gap-1.5 text-[13px] text-text-link hover:underline"
                        >
                          <span className="truncate">{ref.title}</span>
                          <span className="rounded bg-surface-alt px-1 py-0.5 text-[10px] uppercase text-text-muted">
                            {ref.where}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-primary">{children}</dd>
    </div>
  );
}

// ── Edit dialog ────────────────────────────────────────────────────────────────

function EditDialog({
  media,
  folders,
  onOpenChange,
  onSaved,
}: {
  media: SeoMediaRow | null;
  folders: string[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [alt, setAlt] = React.useState("");
  const [folder, setFolder] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (media) {
      setAlt(media.alt ?? "");
      setFolder(media.folder ?? "blog");
    }
  }, [media]);

  const options = Array.from(new Set([...folders, folder].filter(Boolean)));

  return (
    <Dialog open={media !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit image</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="seo-media-alt">Alt text</Label>
            <Input
              id="seo-media-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image for SEO & accessibility"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seo-media-folder">Folder</Label>
            <Select value={folder} onValueChange={setFolder}>
              <SelectTrigger id="seo-media-folder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!media) return;
              setBusy(true);
              try {
                await seoFetch(`/api/seoteam/media/${media.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ alt, folder }),
                });
                toast.success("Saved");
                onOpenChange(false);
                onSaved();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Import-from-URLs dialog ─────────────────────────────────────────────────────

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setText("");
  }, [open]);

  const submit = async () => {
    const urls = Array.from(
      new Set(
        text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    if (urls.length === 0) {
      toast.error("Add at least one image URL.");
      return;
    }
    setBusy(true);
    try {
      const res = await seoFetch<{ imported: number; skipped: number }>(
        "/api/seoteam/media",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        },
      );
      toast.success(
        `Imported ${res.imported}${res.skipped ? `, skipped ${res.skipped}` : ""}`,
      );
      onOpenChange(false);
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from URLs</DialogTitle>
          <DialogDescription>
            Paste image URLs, one per line. They&apos;re added to the blog
            library.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={"https://example.com/one.jpg\nhttps://example.com/two.png"}
          spellCheck={false}
          className="font-mono text-[13px]"
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
