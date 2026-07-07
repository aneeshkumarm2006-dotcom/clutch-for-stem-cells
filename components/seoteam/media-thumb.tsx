"use client";

import * as React from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * MediaThumb — a fill image that degrades to an "image off" placeholder when the
 * source 404s / fails to load (broken Cloudinary URLs, deleted remote assets).
 * Sized by its parent (which must be `relative`); pass `contain` for lightboxes.
 */
export function MediaThumb({
  src,
  alt,
  sizes = "80px",
  contain = false,
  className,
}: {
  src: string;
  alt: string;
  sizes?: string;
  contain?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = React.useState(false);

  // Reset the error state if the source changes (e.g. row reused after refresh).
  React.useEffect(() => setBroken(false), [src]);

  if (broken) {
    return (
      <div
        className={cn(
          "flex size-full items-center justify-center bg-surface-alt text-text-muted",
          className,
        )}
        role="img"
        aria-label={alt || "Image unavailable"}
        title="Image unavailable"
      >
        <ImageOff className="size-1/3 max-h-6 max-w-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized
      onError={() => setBroken(true)}
      className={cn(contain ? "object-contain" : "object-cover", className)}
    />
  );
}
