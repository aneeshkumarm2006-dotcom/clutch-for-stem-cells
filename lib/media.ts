/**
 * Media — uploads + image optimization behind a swappable provider (Stage 3.6 / PRD §12).
 *
 * **Server-only** (uses `node:crypto` + the Cloudinary API secret) — never import
 * from a Client Component. The default {@link MediaProvider} signs and uploads to
 * Cloudinary over its REST API (no SDK dependency); swap {@link mediaProvider} for
 * an UploadThing/S3 implementation without touching call sites.
 *
 * Every upload is validated for MIME type and size first (PRD §13 secure
 * uploads). Returned shape matches the `IImage` sub-document so results drop
 * straight onto a clinic/article. {@link cloudinaryLoader} feeds `next/image`.
 */
import { createHash } from "node:crypto";

import type { IImage } from "@/models";

// ── Validation ───────────────────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

/** Max upload size — 8 MB (PRD §13). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

export class MediaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaConfigError";
  }
}

/** Throw {@link MediaValidationError} unless `type`/`size` are allowed. */
export function validateUpload({
  type,
  size,
}: {
  type: string;
  size: number;
}): void {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)) {
    throw new MediaValidationError(
      `Unsupported file type "${type}". Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}.`,
    );
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new MediaValidationError(
      `File is too large (${Math.round(size / 1024 / 1024)} MB). Max ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    );
  }
}

// ── Provider interface ───────────────────────────────────────────────────────

export interface UploadInput {
  data: Buffer | Uint8Array | ArrayBuffer;
  contentType: string;
  filename?: string;
  /** Logical folder/prefix, e.g. "clinics" or "articles". */
  folder?: string;
}

/** Upload result — superset of the `IImage` sub-document. */
export interface UploadedMedia extends IImage {
  publicId: string;
  format?: string;
  bytes?: number;
}

export interface MediaProvider {
  readonly name: string;
  isConfigured(): boolean;
  upload(input: UploadInput): Promise<UploadedMedia>;
  destroy(publicId: string): Promise<void>;
}

// ── Cloudinary provider (REST, SDK-free) ─────────────────────────────────────

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

/** Cloudinary signed-request signature: sha1 of sorted `k=v` params + secret. */
function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
}

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  error?: { message: string };
}

const cloudinaryProvider: MediaProvider = {
  name: "cloudinary",
  isConfigured: () => cloudinaryConfig() !== null,

  async upload(input: UploadInput): Promise<UploadedMedia> {
    const config = cloudinaryConfig();
    if (!config) {
      throw new MediaConfigError(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET.",
      );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const signed: Record<string, string | number> = { timestamp };
    if (input.folder) signed.folder = input.folder;
    const signature = signParams(signed, config.apiSecret);

    const form = new FormData();
    form.append(
      "file",
      new Blob([input.data as BlobPart], { type: input.contentType }),
      input.filename ?? "upload",
    );
    form.append("api_key", config.apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    if (input.folder) form.append("folder", input.folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
      { method: "POST", body: form },
    );
    const json = (await res.json()) as CloudinaryUploadResponse;
    if (!res.ok || json.error) {
      throw new Error(
        `Cloudinary upload failed: ${json.error?.message ?? res.statusText}`,
      );
    }

    return {
      url: json.secure_url,
      publicId: json.public_id,
      width: json.width,
      height: json.height,
      format: json.format,
      bytes: json.bytes,
    };
  },

  async destroy(publicId: string): Promise<void> {
    const config = cloudinaryConfig();
    if (!config) {
      throw new MediaConfigError("Cloudinary is not configured.");
    }
    const timestamp = Math.round(Date.now() / 1000);
    const signature = signParams(
      { public_id: publicId, timestamp },
      config.apiSecret,
    );

    const form = new FormData();
    form.append("public_id", publicId);
    form.append("api_key", config.apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`,
      { method: "POST", body: form },
    );
    if (!res.ok) {
      throw new Error(`Cloudinary destroy failed: ${res.statusText}`);
    }
  },
};

/**
 * The active media provider (Cloudinary by default). Swap this binding to move
 * the app to UploadThing/S3 — implement {@link MediaProvider} and re-export.
 */
export const mediaProvider: MediaProvider = cloudinaryProvider;

export const isMediaConfigured = (): boolean => mediaProvider.isConfigured();

/** Validate then upload. The single entry point for API upload handlers. */
export async function uploadImage(input: UploadInput): Promise<UploadedMedia> {
  validateUpload({ type: input.contentType, size: byteLength(input.data) });
  return mediaProvider.upload(input);
}

export const destroyImage = (publicId: string): Promise<void> =>
  mediaProvider.destroy(publicId);

function byteLength(data: UploadInput["data"]): number {
  if (data instanceof ArrayBuffer) return data.byteLength;
  return (data as Uint8Array).byteLength;
}

// ── Delivery / next/image optimization ───────────────────────────────────────

export interface ImageTransform {
  width?: number;
  height?: number;
  /** Crop mode (Cloudinary `c_`), default `fill`. */
  crop?: "fill" | "fit" | "limit" | "thumb" | "scale";
  /** Quality 1..100 or `auto` (default). */
  quality?: number | "auto";
}

/**
 * Build a transformed Cloudinary delivery URL for a `publicId`. Always applies
 * `f_auto,q_auto` for format/quality optimization (PRD §13 performance).
 */
export function optimizedImageUrl(
  publicId: string,
  transform: ImageTransform = {},
): string {
  const cloudName =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
    process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return publicId;
  const parts = ["f_auto", `q_${transform.quality ?? "auto"}`];
  if (transform.width) parts.push(`w_${transform.width}`);
  if (transform.height) parts.push(`h_${transform.height}`);
  if (transform.width || transform.height)
    parts.push(`c_${transform.crop ?? "fill"}`);
  return `https://res.cloudinary.com/${cloudName}/image/upload/${parts.join(",")}/${publicId}`;
}

/**
 * `next/image` custom loader for Cloudinary `publicId` sources. Wire on an
 * `<Image loader={cloudinaryLoader} src={publicId} … />`; Cloudinary handles
 * responsive resizing so Next's optimizer is bypassed (no `remotePatterns` needed).
 */
export function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return optimizedImageUrl(src, {
    width,
    quality: quality ?? "auto",
    crop: "limit",
  });
}
