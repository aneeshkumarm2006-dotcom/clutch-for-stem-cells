/**
 * Image optimization — normalize every uploaded raster image to a **WebP** under
 * a byte budget (SEO / page-speed, requested across admin + blog uploads).
 *
 * **Server-only** (uses the native `sharp` bindings). Runs once, inside
 * {@link uploadImage}, so all three upload entry points
 * (`/api/admin/media`, `/api/seoteam/media`, `/api/seoteam/upload`) inherit it.
 *
 * Strategy: downscale oversized images, then encode WebP at descending quality
 * until the result fits {@link TARGET_MAX_BYTES}. If the source is already a
 * small-enough WebP we leave it untouched. Animated GIFs become animated WebP.
 * On any failure we fall back to the original bytes — an upload must never break
 * because optimization hiccupped (project convention: graceful degradation).
 */
import sharp from "sharp";

/** Target ceiling for an optimized image — 300 KB (SEO / speed). */
export const TARGET_MAX_BYTES = 300 * 1024;

/**
 * Longest-edge caps, tried largest-first. Nothing on the site is displayed
 * wider than 2000px; the smaller rungs are a fallback for images so detailed
 * that quality reduction alone can't reach the byte budget (capping dimensions
 * is the biggest lever). The final rung guarantees convergence.
 */
const DIMENSION_STEPS = [2000, 1600, 1280, 1024, 800, 640] as const;

/** WebP quality ladder — try high quality first, step down until it fits. */
const QUALITY_STEPS = [82, 72, 62, 52, 42, 32] as const;

export interface OptimizedImage {
  data: Buffer;
  contentType: string;
  filename?: string;
  /** True when the bytes/format were actually changed. */
  converted: boolean;
}

/** Swap (or append) a `.webp` extension on a filename for the WebP output. */
function toWebpFilename(filename?: string): string | undefined {
  if (!filename) return filename;
  return filename.replace(/\.[^./\\]+$/, "") + ".webp";
}

/**
 * Convert `data` to a WebP buffer no larger than {@link TARGET_MAX_BYTES}.
 * Returns the original untouched when it's already a compact WebP, or when
 * `sharp` cannot process the input (falls back rather than throwing).
 */
export async function optimizeToWebp(
  data: Buffer,
  { contentType, filename }: { contentType: string; filename?: string },
): Promise<OptimizedImage> {
  const passthrough: OptimizedImage = {
    data,
    contentType,
    filename,
    converted: false,
  };

  // SVGs are vectors — rasterizing to WebP would bloat and blur them. Leave
  // any non-raster / unknown type to the caller's existing handling.
  if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
    return passthrough;
  }

  try {
    let meta;
    try {
      meta = await sharp(data, { animated: true }).metadata();
    } catch {
      // Not a decodable raster (or corrupt) — let the upload proceed as-is.
      return passthrough;
    }

    const isAnimated = (meta.pages ?? 1) > 1;
    const alreadyWebp = meta.format === "webp";
    const longestEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    const oversized = longestEdge > DIMENSION_STEPS[0];

    // Fast path: a WebP that's already small enough and not oversized.
    if (alreadyWebp && !oversized && data.byteLength <= TARGET_MAX_BYTES) {
      return passthrough;
    }

    const encode = (dimension: number, quality: number): Promise<Buffer> => {
      const pipeline = sharp(data, { animated: isAnimated });
      // Only downscale — never upscale a source that's already smaller.
      if (longestEdge > dimension) {
        pipeline.resize({
          width: dimension,
          height: dimension,
          fit: "inside",
          withoutEnlargement: true,
        });
      }
      return pipeline.webp({ quality, effort: 4 }).toBuffer();
    };

    // Widen the search largest-dimension-first; within each size, drop quality
    // until it fits. Keep the smallest buffer produced as the fallback so a
    // pathologically incompressible image still lands at the tightest option.
    let best: Buffer | null = null;
    outer: for (const dimension of DIMENSION_STEPS) {
      if (dimension > longestEdge && dimension !== DIMENSION_STEPS[0]) continue;
      for (const quality of QUALITY_STEPS) {
        const out = await encode(dimension, quality);
        if (!best || out.byteLength < best.byteLength) best = out;
        if (out.byteLength <= TARGET_MAX_BYTES) break outer;
      }
    }

    if (!best) return passthrough;

    // If we somehow produced something larger than the original (rare, tiny
    // already-optimized files), keep whichever is smaller.
    const chosen =
      best.byteLength < data.byteLength || !alreadyWebp ? best : data;
    if (chosen === data && alreadyWebp) return passthrough;

    return {
      data: chosen,
      contentType: "image/webp",
      filename: toWebpFilename(filename),
      converted: true,
    };
  } catch {
    return passthrough;
  }
}
