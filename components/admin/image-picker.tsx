"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Trash2, ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/form-field";
import { MediaLibraryDialog } from "@/components/admin/media-library-dialog";
import type { ImageView } from "@/lib/admin/serialize";

/** Single-image field (logo, cover, OG, avatar) — preview + alt + replace/remove. */
export function ImagePicker({
  value,
  onChange,
  label,
  hint,
  folder,
  className,
  aspect = "video",
}: {
  value?: ImageView;
  onChange: (value: ImageView | undefined) => void;
  label?: string;
  hint?: string;
  folder?: string;
  className?: string;
  aspect?: "video" | "square";
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <Label>{label}</Label> : null}
      {value?.url ? (
        <div className="flex gap-3">
          <div
            className={cn(
              "relative w-32 flex-none overflow-hidden rounded-lg border border-border bg-surface-alt",
              aspect === "square" ? "aspect-square" : "aspect-video",
            )}
          >
            <Image
              src={value.url}
              alt={value.alt ?? ""}
              fill
              sizes="128px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input
              value={value.alt ?? ""}
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
              placeholder="Alt text (describe the image)"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setOpen(true)}
              >
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(undefined)}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-6 text-sm text-text-secondary hover:border-primary hover:text-text-primary",
          )}
        >
          <ImagePlus className="size-4" />
          Select image
        </button>
      )}
      {hint ? <p className="text-[12.5px] text-text-muted">{hint}</p> : null}
      <MediaLibraryDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={onChange}
        folder={folder}
      />
    </div>
  );
}

/** Multi-image gallery field — add (batch), reorder, remove. */
export function GalleryField({
  value,
  onChange,
  label,
  folder,
  className,
}: {
  value: ImageView[];
  onChange: (value: ImageView[]) => void;
  label?: string;
  folder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label>{label}</Label> : null}
      {value.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((img, i) => (
            <div
              key={`${img.url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-alt"
            >
              <Image
                src={img.url}
                alt={img.alt ?? ""}
                fill
                sizes="120px"
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-ink/55 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="rounded p-1 text-white disabled:opacity-40"
                  aria-label="Move left"
                >
                  <ArrowLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                  className="rounded p-1 text-white"
                  aria-label="Remove"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === value.length - 1}
                  className="rounded p-1 text-white disabled:opacity-40"
                  aria-label="Move right"
                >
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        <ImagePlus className="size-4" />
        Add images
      </Button>
      <MediaLibraryDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={(img) => onChange([...value, img])}
        folder={folder}
        multiple
      />
    </div>
  );
}
