"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Upload, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { adminFetch } from "@/lib/admin/client";
import type { AdminMediaRow } from "@/lib/admin/media";

function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaLibrary({
  rows,
  page,
  totalPages,
  total,
  pageSize,
}: {
  rows: AdminMediaRow[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminMediaRow | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<AdminMediaRow | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", "library");
        const res = await fetch("/api/admin/media", { method: "POST", body: form });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      }
      toast.success("Uploaded");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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
      <div className="mb-4 flex items-center gap-2.5">
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
          <Upload className="size-4" />
          {uploading ? "Uploading…" : "Upload images"}
        </Button>
        <span className="ml-auto text-[13px] text-text-muted">
          {total} {total === 1 ? "image" : "images"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface p-12 text-center text-sm text-text-muted">
          No images yet. Upload one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((m) => (
            <div
              key={m.id}
              className="group overflow-hidden rounded-xl border border-border bg-surface"
            >
              <div className="relative aspect-square bg-surface-alt">
                <Image
                  src={m.url}
                  alt={m.alt ?? ""}
                  fill
                  sizes="200px"
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-ink/55 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
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
                    onClick={() => setEditing(m)}
                    className="rounded p-1 text-white hover:bg-white/20"
                    aria-label="Edit"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteFor(m)}
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
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between text-[13px] text-text-muted">
          <span>{`Showing ${start}–${end} of ${total}`}</span>
          <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
        </div>
      ) : null}

      <EditDialog
        media={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => router.refresh()}
      />
      <ConfirmDialog
        open={deleteFor !== null}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        title="Delete image"
        description="Delete this image from the library and storage? Anything using its URL will break."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteFor) return;
          try {
            await adminFetch(`/api/admin/media/${deleteFor.id}`, {
              method: "DELETE",
            });
            toast.success("Deleted");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not delete.");
          }
        }}
      />
    </>
  );
}

function EditDialog({
  media,
  onOpenChange,
  onSaved,
}: {
  media: AdminMediaRow | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [alt, setAlt] = React.useState("");
  const [folder, setFolder] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (media) {
      setAlt(media.alt ?? "");
      setFolder(media.folder ?? "");
    }
  }, [media]);

  return (
    <Dialog open={media !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit image</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="media-alt">Alt text</Label>
            <Input
              id="media-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="media-folder">Folder</Label>
            <Input
              id="media-folder"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            />
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
                await adminFetch(`/api/admin/media/${media.id}`, {
                  method: "PATCH",
                  body: { alt, folder },
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
