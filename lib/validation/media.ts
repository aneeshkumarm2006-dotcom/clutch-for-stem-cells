/**
 * Media validation (PRD §8.11 / Stage 6.13) — admin media library.
 *
 * Binary uploads are validated by `lib/media.ts` (MIME/size); this covers the
 * metadata stored alongside an upload and edits to it (alt text, folder).
 */
import { z } from "zod";
import { mediaUrlSchema, objectIdSchema } from "@/lib/validation/common";

/** Max tags per image / max characters per tag (keeps chips scannable). */
export const MAX_TAGS_PER_IMAGE = 25;
export const MAX_TAG_LENGTH = 40;

/** Normalize one tag: trim, lowercase, collapse whitespace. Empty → null. */
export function normalizeTag(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  return t.slice(0, MAX_TAG_LENGTH);
}

/** Clean + dedupe a list of tags, capped at {@link MAX_TAGS_PER_IMAGE}. */
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = normalizeTag(r);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TAGS_PER_IMAGE) break;
  }
  return out;
}

const tagsSchema = z
  .array(z.string().max(MAX_TAG_LENGTH + 20))
  .max(MAX_TAGS_PER_IMAGE + 20)
  .transform((arr) => normalizeTags(arr));

/** Persisted after a successful provider upload (or a manual URL entry). */
export const mediaCreateSchema = z.object({
  url: mediaUrlSchema,
  publicId: z.string().max(300).optional(),
  alt: z.string().max(300).optional(),
  filename: z.string().max(300).optional(),
  folder: z.string().max(120).optional(),
  format: z.string().max(20).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().positive().optional(),
  uploadedBy: objectIdSchema.nullish(),
});

/** Library edit — only the human-editable metadata (alt / folder / tags). */
export const mediaUpdateSchema = z
  .object({
    alt: z.string().max(300),
    folder: z.string().max(120),
    tags: tagsSchema,
  })
  .partial();

/** Bulk action over selected library rows (seoteam gallery). */
export const mediaBulkSchema = z.object({
  ids: z.array(objectIdSchema).min(1, "Select at least one image."),
  action: z.enum(["delete", "setFolder", "addTag", "removeTag"]),
  value: z
    .string()
    .max(MAX_TAG_LENGTH + 20)
    .optional(),
});

/** Bulk-import a list of pasted image URLs (seoteam gallery). */
export const mediaUrlImportSchema = z.object({
  urls: z
    .array(mediaUrlSchema)
    .min(1, "Add at least one image URL.")
    .max(100, "Import up to 100 URLs at a time."),
});

export type MediaInput = z.infer<typeof mediaCreateSchema>;
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
export type MediaBulkInput = z.infer<typeof mediaBulkSchema>;
export type MediaUrlImportInput = z.infer<typeof mediaUrlImportSchema>;
