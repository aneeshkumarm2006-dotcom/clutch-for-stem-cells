"use client";

import * as React from "react";
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
  AlertTriangle,
  LayoutGrid,
  List,
  Plus,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/form-field";
import { Chip } from "@/components/ui/chip";
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
import type {
  MediaSort,
  SeoMediaResult,
  SeoMediaRow,
} from "@/lib/seoteam/media-data";
import { MediaThumb } from "@/components/seoteam/media-thumb";
import { MediaTable } from "@/components/seoteam/media-table";
import { copyToClipboard } from "@/components/seoteam/media-actions";
import { seoFetchRaw } from "@/lib/seoteam/client";

const ALL_FOLDERS = "__all__";
const VIEW_STORAGE_KEY = "seoteam.media.view";

type View = "grid" | "table";

export function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Shared Studio fetch: redirects to login on a 401 (expired session) rather than
// dead-ending on an "Unauthorized." toast. See lib/seoteam/client.ts.
const seoFetch = seoFetchRaw;

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
  const [bulkTag, setBulkTag] = React.useState("");

  // ── View (grid | table), persisted in localStorage ─────────────────────────
  const [view, setView] = React.useState<View>("grid");
  React.useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "table") setView(stored);
  }, []);
  const changeView = (next: View) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  // ── Optimistic inline-edit overrides (alt / tags) ──────────────────────────
  const [overrides, setOverrides] = React.useState<
    Record<string, Partial<SeoMediaRow>>
  >({});
  // Fresh server data supersedes any pending optimistic overrides.
  React.useEffect(() => setOverrides({}), [rows]);

  const displayRows = React.useMemo(
    () => rows.map((r) => (overrides[r.id] ? { ...r, ...overrides[r.id] } : r)),
    [rows, overrides],
  );

  const saveInline = React.useCallback(
    async (id: string, patch: Partial<SeoMediaRow>) => {
      setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
      try {
        await seoFetch(`/api/seoteam/media/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        toast.success("Saved");
      } catch (e) {
        // Roll back only the fields we tried to change.
        setOverrides((prev) => {
          const cur = { ...(prev[id] ?? {}) } as Record<string, unknown>;
          for (const k of Object.keys(patch)) delete cur[k];
          return { ...prev, [id]: cur as Partial<SeoMediaRow> };
        });
        toast.error(e instanceof Error ? e.message : "Could not save.");
        throw e;
      }
    },
    [],
  );

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
  const currentSort = (sp.get("sort") as MediaSort) || "newest";
  const currentFilter = sp.get("filter"); // "unused" | "missing-alt" | null

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
      toast.success(
        `Uploaded ${res.uploaded} image${res.uploaded === 1 ? "" : "s"}`,
      );
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

  const runBulk = async (
    action: "delete" | "setFolder" | "addTag" | "removeTag",
    value?: string,
  ) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      const res = await seoFetch<{ count: number }>("/api/seoteam/media/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, value }),
      });
      const noun = `image${res.count === 1 ? "" : "s"}`;
      toast.success(
        action === "delete"
          ? `Deleted ${res.count} ${noun}`
          : action === "setFolder"
            ? `Moved ${res.count} ${noun}`
            : action === "addTag"
              ? `Tagged ${res.count} ${noun}`
              : `Untagged ${res.count} ${noun}`,
      );
      if (action === "delete" || action === "setFolder") setSelected(new Set());
      if (action === "addTag" || action === "removeTag") setBulkTag("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  };

  const bulkCopyUrls = () => {
    const urls = displayRows
      .filter((r) => selected.has(r.id))
      .map((r) => r.url);
    if (!urls.length) return;
    void copyToClipboard(
      urls.join("\n"),
      `Copied ${urls.length} URL${urls.length === 1 ? "" : "s"}`,
    );
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

  const folderOptions = Array.from(new Set(["blog", ...data.folders]));

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
            placeholder="Search by name, alt text, or tag"
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
            <SelectItem value="dimensions">Dimensions</SelectItem>
            <SelectItem value="usage">Most used</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div
          role="group"
          aria-label="View"
          className="flex items-center rounded-md border border-border bg-surface p-0.5"
        >
          <ViewToggleButton
            active={view === "grid"}
            label="Grid view"
            onClick={() => changeView("grid")}
          >
            <LayoutGrid className="size-4" />
          </ViewToggleButton>
          <ViewToggleButton
            active={view === "table"}
            label="Table view"
            onClick={() => changeView("table")}
          >
            <List className="size-4" />
          </ViewToggleButton>
        </div>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={currentFilter === "unused" ? "primary" : "secondary"}
          onClick={() =>
            setParams({
              filter: currentFilter === "unused" ? undefined : "unused",
            })
          }
        >
          <ImageOff className="size-4" />
          Unused
          <span className="text-text-muted">{data.stats.unused}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={currentFilter === "missing-alt" ? "primary" : "secondary"}
          onClick={() =>
            setParams({
              filter:
                currentFilter === "missing-alt" ? undefined : "missing-alt",
            })
          }
        >
          <AlertTriangle className="size-4" />
          Missing alt
          <span className="text-text-muted">{data.stats.missingAlt}</span>
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
        <Button
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
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
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setImportOpen(true)}
        >
          <Link2 className="size-4" /> Import from URLs
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={scan}
          disabled={scanning}
        >
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

      {/* Views */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface p-12 text-center text-sm text-text-muted">
          {currentFilter === "unused"
            ? "No unused images — every image here is attached to a post."
            : currentFilter === "missing-alt"
              ? "No images missing alt text — nice, your library is fully described."
              : "No images yet. Upload some, import URLs, or scan your posts."}
        </div>
      ) : view === "table" ? (
        <MediaTable
          rows={displayRows}
          selected={selected}
          allOnPage={allOnPage}
          currentSort={currentSort}
          onToggleOne={toggleOne}
          onToggleAll={toggleAll}
          onSort={(s) => setParams({ sort: s === "newest" ? undefined : s })}
          onPreview={setDetailFor}
          onEdit={setEditing}
          onDelete={setDeleteFor}
          onSaveInline={saveInline}
        />
      ) : (
        <MediaGrid
          rows={displayRows}
          selected={selected}
          onToggleOne={toggleOne}
          onPreview={setDetailFor}
          onEdit={setEditing}
          onDelete={setDeleteFor}
        />
      )}

      {data.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between text-[13px] text-text-muted">
          <span>{`Showing ${start}–${end} of ${data.total}`}</span>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={hrefFor}
          />
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
            <Button size="sm" variant="secondary" onClick={bulkCopyUrls}>
              <Copy className="size-4" /> Copy URLs
            </Button>

            <div className="flex items-center gap-1">
              <div className="relative">
                <Tag className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
                <Input
                  value={bulkTag}
                  onChange={(e) => setBulkTag(e.target.value)}
                  placeholder="tag"
                  aria-label="Bulk tag"
                  className="h-9 w-28 pl-7"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!bulkTag.trim()}
                onClick={() => runBulk("addTag", bulkTag)}
                title="Add tag to selected"
              >
                <Plus className="size-4" /> Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!bulkTag.trim()}
                onClick={() => runBulk("removeTag", bulkTag)}
                title="Remove tag from selected"
              >
                Remove
              </Button>
            </div>

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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              <X className="size-4" /> Clear
            </Button>
          </div>
        </div>
      ) : null}

      {/* Detail / lightbox dialog */}
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

// ── View toggle button ───────────────────────────────────────────────────────

function ViewToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "bg-primary text-primary-foreground"
          : "text-text-muted hover:bg-surface-alt hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

// ── Grid view ────────────────────────────────────────────────────────────────

function MediaGrid({
  rows,
  selected,
  onToggleOne,
  onPreview,
  onEdit,
  onDelete,
}: {
  rows: SeoMediaRow[];
  selected: Set<string>;
  onToggleOne: (id: string) => void;
  onPreview: (row: SeoMediaRow) => void;
  onEdit: (row: SeoMediaRow) => void;
  onDelete: (row: SeoMediaRow) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {rows.map((m) => {
        const isSelected = selected.has(m.id);
        const missingAlt = !m.alt?.trim();
        return (
          <div
            key={m.id}
            className={cn(
              "group overflow-hidden rounded-xl border bg-surface transition-colors",
              isSelected
                ? "border-primary ring-1 ring-primary"
                : "border-border",
            )}
          >
            <div
              className="relative aspect-square cursor-pointer bg-surface-alt"
              onClick={() => onPreview(m)}
            >
              <MediaThumb src={m.url} alt={m.alt ?? ""} sizes="200px" />

              {/* Selection checkbox */}
              <button
                type="button"
                aria-label={isSelected ? "Deselect" : "Select"}
                aria-pressed={isSelected}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleOne(m.id);
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

              {/* Missing-alt flag */}
              {missingAlt ? (
                <span
                  className="absolute left-1.5 top-8 inline-flex items-center gap-1 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  title="Missing alt text"
                >
                  <AlertTriangle className="size-3" /> No alt
                </span>
              ) : null}

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
                    void copyToClipboard(m.url, "URL copied");
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
                    onEdit(m);
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
                    onDelete(m);
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
              <MediaThumb
                src={media.url}
                alt={media.alt ?? ""}
                sizes="320px"
                contain
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
                <Meta label="Alt text">
                  {media.alt?.trim() ? (
                    media.alt
                  ) : (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <AlertTriangle className="size-3.5" /> Missing
                    </span>
                  )}
                </Meta>
              </dl>

              {media.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {media.tags.map((t) => (
                    <Chip key={t} size="sm">
                      {t}
                    </Chip>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyToClipboard(media.url, "URL copied")}
                >
                  <Copy className="size-4" /> Copy URL
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onEdit(media)}
                >
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

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-text-primary">{children}</dd>
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
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagDraft, setTagDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (media) {
      setAlt(media.alt ?? "");
      setFolder(media.folder ?? "blog");
      setTags(media.tags);
      setTagDraft("");
    }
  }, [media]);

  const options = Array.from(new Set([...folders, folder].filter(Boolean)));

  const addTag = () => {
    const next = tagDraft.trim().toLowerCase();
    setTagDraft("");
    if (!next || tags.includes(next)) return;
    setTags((prev) => [...prev, next]);
  };

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
          <div className="space-y-1.5">
            <Label htmlFor="seo-media-tag">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Chip
                  key={t}
                  size="sm"
                  onRemove={() =>
                    setTags((prev) => prev.filter((x) => x !== t))
                  }
                >
                  {t}
                </Chip>
              ))}
            </div>
            <Input
              id="seo-media-tag"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="Add a tag, press Enter"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
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
                  body: JSON.stringify({ alt, folder, tags }),
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
          placeholder={
            "https://example.com/one.jpg\nhttps://example.com/two.png"
          }
          spellCheck={false}
          className="font-mono text-[13px]"
        />
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
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
