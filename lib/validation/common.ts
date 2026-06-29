/**
 * Shared Zod primitives — Stage 1.10.
 *
 * Mongoose-free (these schemas ship to client forms). Per-model schemas under
 * `/lib/validation` compose these. Enum tuples are imported from `@/lib/enums`
 * so models and validation stay in lockstep.
 */
import { z } from "zod";

/** 24-char hex Mongo ObjectId (refs arrive as strings from forms/JSON). */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/** URL-safe slug: lowercase words joined by single hyphens. */
export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens",
  );

/** Absolute http(s) URL or root-relative path (media may be either). */
export const mediaUrlSchema = z
  .string()
  .min(1)
  .refine(
    (v) => /^https?:\/\//.test(v) || v.startsWith("/"),
    "Must be a URL or a root-relative path",
  );

export const imageSchema = z.object({
  url: mediaUrlSchema,
  alt: z.string().max(300).optional(),
  publicId: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const seoSchema = z
  .object({
    metaTitle: z.string().max(120).optional(),
    metaDescription: z.string().max(320).optional(),
    ogImage: mediaUrlSchema.optional(),
    canonicalUrl: z.string().url().optional(),
    noindex: z.boolean().optional(),
  })
  .partial();

export const personSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  title: z.string().max(160).optional(),
  credentials: z.string().max(200).optional(),
  photo: imageSchema.optional(),
  bio: z.string().max(2000).optional(),
});

/** ISO-4217-ish currency code (3 uppercase letters). */
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code")
  .default("USD");

/** A 1–5 integer star rating. */
export const ratingValueSchema = z.number().int().min(1).max(5);

/** Consent / age gates (PRD §14, §8.6) — must be explicitly true. */
export const consentTrueSchema = z.literal(true, {
  errorMap: () => ({ message: "Consent is required" }),
});
export const ageConfirmedSchema = z.literal(true, {
  errorMap: () => ({ message: "You must confirm you are 18 or older" }),
});

export type ImageInput = z.infer<typeof imageSchema>;
export type SeoInput = z.infer<typeof seoSchema>;
export type PersonInput = z.infer<typeof personSchema>;
