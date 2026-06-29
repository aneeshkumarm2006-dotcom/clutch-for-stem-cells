/**
 * Media validation (PRD §8.11 / Stage 6.13) — admin media library.
 *
 * Binary uploads are validated by `lib/media.ts` (MIME/size); this covers the
 * metadata stored alongside an upload and edits to it (alt text, folder).
 */
import { z } from "zod";
import { mediaUrlSchema, objectIdSchema } from "@/lib/validation/common";

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

/** Library edit — only the human-editable metadata. */
export const mediaUpdateSchema = z
  .object({
    alt: z.string().max(300),
    folder: z.string().max(120),
  })
  .partial();

export type MediaInput = z.infer<typeof mediaCreateSchema>;
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
