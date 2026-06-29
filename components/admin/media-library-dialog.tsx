"use client";

import * as React from "react";
import Image from "next/image";
import { Search, Upload, Link2, Check } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ImageView } from "@/lib/admin/serialize";

interface MediaItem extends ImageView {
  id: string;
  filename?: string;
}

/**
 * Central media interaction surface (Stage 6.13) — upload, paste-URL, and browse
 * the library, returning the chosen `ImageView`(s). Reused by ImagePicker,
 * GalleryField, and the Media library page. `multiple` keeps it open for
 * batch-adding to a gallery.
 */
export function MediaLibraryDialog({
  open,
  onOpenChange,
  onSelect,
  folder = "library",
  multiple = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (image: ImageView) => void;
  folder?: string;
  multiple?: boolean;
}) {
  const [items, setItems] = React.useState<MediaItem[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [urlDraft, setUrlDraft] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/media?pageSize=48${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      );
      const data = (await res.json()) as { rows: MediaItem[] };
      setItems(data.rows ?? []);
    } catch {
      /* leave list as-is */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) load("");
  }, [open, load]);

  const pick = (img: ImageView) => {
    onSelect(img);
    if (!multiple) onOpenChange(false);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", folder);
        const res = await fetch("/api/admin/media", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as MediaItem & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
        pick(data);
        setItems((prev) => [data, ...prev]);
      }
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleUrl = async () => {
    const url = urlDraft.trim();
    if (!url) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, folder }),
      });
      const data = (await res.json()) as MediaItem & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add image.");
      pick(data);
      setItems((prev) => [data, ...prev]);
      setUrlDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple={multiple}
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload className="size-4" />
            Upload
          </Button>
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrl()}
                placeholder="Paste an image URL"
                className="pl-9"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleUrl}
              disabled={busy || !urlDraft.trim()}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              load(e.target.value);
            }}
            placeholder="Search the library"
            className="pl-9"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-sm text-text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-muted">
              No images yet. Upload or paste a URL above.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pick(item)}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-alt",
                    "hover:border-primary focus-visible:border-primary",
                  )}
                  title={item.filename ?? item.url}
                >
                  <Image
                    src={item.url}
                    alt={item.alt ?? ""}
                    fill
                    sizes="120px"
                    className="object-cover"
                    unoptimized
                  />
                  <span className="absolute inset-0 hidden items-center justify-center bg-primary/15 group-hover:flex">
                    <Check className="size-5 text-primary-foreground drop-shadow" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {multiple ? (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
