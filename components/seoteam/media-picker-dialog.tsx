"use client";

import * as React from "react";
import Image from "next/image";
import { Search, Loader2, ImageOff } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface PickedImage {
  url: string;
  alt?: string;
}

interface PickerRow {
  id: string;
  url: string;
  alt?: string;
  filename?: string;
  usageCount: number;
}

/**
 * Browse the blog media library and pick an existing image — so writers reuse
 * images instead of re-uploading. Fetches `/api/seoteam/media` client-side
 * (seoteam cookie auth) with a debounced search.
 */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (image: PickedImage) => void;
}) {
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<PickerRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ folder: "blog", sort: "newest" });
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(`/api/seoteam/media?${params.toString()}`);
        const data = (await res.json()) as { rows?: PickerRow[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not load images.");
        if (active) setRows(data.rows ?? []);
      } catch (e) {
        if (active) toast.error(e instanceof Error ? e.message : "Load failed.");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [open, q]);

  // Reset the query each time the dialog opens fresh.
  React.useEffect(() => {
    if (open) setQ("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose from library</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search images…"
            className="pl-9"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-text-muted">
              <ImageOff className="size-6" />
              No images found. Upload some from the editor or the Media page.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {rows.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect({ url: m.url, alt: m.alt ?? "" });
                    onOpenChange(false);
                  }}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-alt transition-colors hover:border-primary"
                  title={m.filename ?? m.alt ?? "Insert image"}
                >
                  <Image
                    src={m.url}
                    alt={m.alt ?? ""}
                    fill
                    sizes="160px"
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
