"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Trash2, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/form-field";

export interface ImageValue {
  url: string;
  alt?: string;
}

/** Upload a single image file to the SEO-team endpoint; returns its URL. */
export async function uploadBlogImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/seoteam/upload", { method: "POST", body: form });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    throw new Error(
      (payload as { error?: string } | null)?.error ?? "Upload failed.",
    );
  }
  return payload as { url: string };
}

/** Cover-image field: drag/drop or click to upload, or paste a URL, plus alt. */
export function ImageField({
  value,
  onChange,
  label = "Cover image",
}: {
  value?: ImageValue;
  onChange: (value: ImageValue | undefined) => void;
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [urlMode, setUrlMode] = React.useState(false);
  const [urlValue, setUrlValue] = React.useState("");

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const { url } = await uploadBlogImage(file);
      onChange({ url, alt: value?.alt ?? "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={() => setUrlMode((v) => !v)}
          className="inline-flex items-center gap-1 text-[12px] text-text-link hover:underline"
        >
          <Link2 className="size-3.5" />
          {urlMode ? "Upload instead" : "Paste URL"}
        </button>
      </div>

      {value?.url ? (
        <div className="flex gap-3">
          <div className="relative aspect-video w-36 flex-none overflow-hidden rounded-lg border border-border bg-surface-alt">
            <Image
              src={value.url}
              alt={value.alt ?? ""}
              fill
              sizes="144px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input
              value={value.alt ?? ""}
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
              placeholder="Alt text (describe the image for SEO)"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
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
      ) : urlMode ? (
        <div className="flex gap-2">
          <Input
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              if (/^https?:\/\//i.test(urlValue.trim())) {
                onChange({ url: urlValue.trim(), alt: "" });
                setUrlValue("");
                setUrlMode(false);
              } else {
                toast.error("Enter a valid http(s) image URL.");
              }
            }}
          >
            Use
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm transition-colors",
            dragOver
              ? "border-primary bg-azure-50 text-text-primary"
              : "border-border-strong text-text-secondary hover:border-primary hover:text-text-primary",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="size-4" /> Drag & drop or click to upload
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
