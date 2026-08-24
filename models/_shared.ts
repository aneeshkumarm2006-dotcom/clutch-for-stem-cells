/**
 * Shared Mongoose building blocks — Stage 1.
 *
 * Reusable sub-schemas (image, seo, person), the soft-delete plugin, and the
 * `registerModel` helper that makes model definition idempotent across Next.js
 * hot-reloads and warm serverless lambdas (avoids `OverwriteModelError`).
 */
import {
  Schema,
  model,
  models,
  type Model,
  type Types,
  type HydratedDocument,
} from "mongoose";

import {
  BLOCK_TYPES,
  TWITTER_CARD_TYPES,
  type BlockType,
  type TwitterCardType,
} from "@/lib/enums";

// ── Base type fragments (mixed into each model interface) ────────────────────

/** `createdAt`/`updatedAt` provided by `{ timestamps: true }`. */
export interface TimestampFields {
  createdAt: Date;
  updatedAt: Date;
}

/** Soft-delete fields added by {@link softDeletePlugin}. */
export interface SoftDeleteFields {
  isDeleted: boolean;
  deletedAt: Date | null;
}

// ── Value-object sub-schemas ────────────────────────────────────────────────

/**
 * Image reference. Stored inline (a `Media` collection is Stage 6.13); `publicId`
 * holds the Cloudinary id so an item can later be linked to a media record.
 * PRD §5.1 calls these "media ref" — embedding keeps Stage 1 self-contained.
 */
export interface IImage {
  url: string;
  alt?: string;
  publicId?: string;
  width?: number;
  height?: number;
}

export const imageSchema = new Schema<IImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true },
    publicId: { type: String, trim: true },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
  },
  { _id: false },
);

/**
 * Per-document SEO overrides (PRD §5.1, §11). Defaults come from SiteSetting.
 *
 * The first five keys are the original set; the rest were added with the
 * modular content/SEO layer. **Every added field is optional**, so existing
 * documents (which simply lack them) keep resolving exactly as before —
 * `buildMetadata` falls back to the derived/global value whenever one is unset.
 */
export interface ISeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  /** OpenGraph title/description — fall back to metaTitle/metaDescription. */
  ogTitle?: string;
  ogDescription?: string;
  /** Twitter/X card type. Falls back to the Settings default. */
  twitterCard?: TwitterCardType;
  /** Editorial focus keyword — drives the SEO checks panel, never emitted. */
  focusKeyword?: string;
  /**
   * Granular robots control. `noindex` above remains the coarse switch (and is
   * OR-ed in); this adds `follow` so an editor can express `index, nofollow`.
   * Unset means "inherit" — see `buildMetadata`.
   */
  robots?: IRobots;
}

/** Granular robots directives. Unset keys mean "inherit / default". */
export interface IRobots {
  index?: boolean;
  follow?: boolean;
}

const robotsSchema = new Schema<IRobots>(
  {
    index: { type: Boolean },
    follow: { type: Boolean },
  },
  { _id: false },
);

export const seoSchema = new Schema<ISeo>(
  {
    metaTitle: { type: String, trim: true, maxlength: 120 },
    metaDescription: { type: String, trim: true, maxlength: 320 },
    ogImage: { type: String, trim: true },
    canonicalUrl: { type: String, trim: true },
    noindex: { type: Boolean, default: false },
    ogTitle: { type: String, trim: true, maxlength: 120 },
    ogDescription: { type: String, trim: true, maxlength: 320 },
    twitterCard: { type: String, enum: TWITTER_CARD_TYPES },
    focusKeyword: { type: String, trim: true, maxlength: 120 },
    robots: { type: robotsSchema, default: undefined },
  },
  { _id: false },
);

// ── Structured-data overrides (the schema engine's per-page seam) ────────────

/**
 * Per-page control over the auto-generated JSON-LD. The engine
 * (`lib/schema/engine.ts`) builds a record's nodes from the content-type map in
 * `config/content-engine`, then applies this: nodes named in `disabledNodes` are
 * dropped, `fieldOverrides` shallow-overwrite keys on the matching node, and
 * `customJsonLd` (raw, editor-authored) is appended.
 *
 * All-optional and additive: a record without `schemaOverrides` gets the plain
 * auto-generated graph, which is exactly what every existing document does now.
 */
export interface ISchemaOverrides {
  /** schema.org `@type`s to omit for this page, e.g. ["AggregateRating"]. */
  disabledNodes?: string[];
  /**
   * `{ "MedicalClinic": { "name": "…" } }` — shallow field overrides applied to
   * the node with that `@type`. Stored as a free-form map (values are arbitrary
   * JSON), so it is `Schema.Types.Mixed`.
   */
  fieldOverrides?: Record<string, Record<string, unknown>>;
  /** Raw advanced-case JSON-LD, appended verbatim. Validated as JSON on save. */
  customJsonLd?: string;
}

export const schemaOverrideSchema = new Schema<ISchemaOverrides>(
  {
    disabledNodes: { type: [String], default: [] },
    fieldOverrides: { type: Schema.Types.Mixed, default: undefined },
    customJsonLd: { type: String, default: undefined },
  },
  { _id: false },
);

// ── Modular content blocks ──────────────────────────────────────────────────

/**
 * One block in a Page's ordered composition. `type` selects the entry in the
 * block registry (`lib/blocks/registry.ts`), which owns the Zod schema for
 * `data`, the public renderer, and the optional `toSchemaOrg()` mapping.
 *
 * `data` is `Mixed` because each block type has its own shape; it is validated
 * by the registry's discriminated-union Zod schema on every write (and HTML
 * inside it is sanitized server-side), so nothing unvalidated ever lands here.
 */
export interface IBlock {
  type: BlockType;
  data: Record<string, unknown>;
}

export const blockSchema = new Schema<IBlock>(
  {
    type: { type: String, enum: BLOCK_TYPES, required: true },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false },
);

/** Team member / medical director (PRD §5.1). Keeps `_id` for repeatable edits. */
export interface IPerson {
  _id?: Types.ObjectId;
  name: string;
  title?: string;
  credentials?: string;
  photo?: IImage;
  bio?: string;
}

export const personSchema = new Schema<IPerson>({
  name: { type: String, required: true, trim: true },
  title: { type: String, trim: true },
  credentials: { type: String, trim: true },
  photo: { type: imageSchema, default: undefined },
  bio: { type: String, trim: true },
});

// ── Editorial content sub-schemas (taxonomy enrichment + combination pages) ──

/** A scoped Q&A pair. Reused by editorial `faqs` on terms + MatrixPages. */
export interface IFaqEntry {
  _id?: Types.ObjectId;
  question: string;
  answer: string;
}

export const faqSchema = new Schema<IFaqEntry>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false },
);

/**
 * A single sourced fact (label/value + a visible citation URL) — rendered as a
 * key-facts table for extractability and E-E-A-T. `sourceUrl` should point at a
 * primary source (PubMed, clinicaltrials.gov, a regulator).
 */
export interface IKeyFact {
  _id?: Types.ObjectId;
  label: string;
  value: string;
  sourceUrl?: string;
}

export const keyFactSchema = new Schema<IKeyFact>(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: String, required: true, trim: true, maxlength: 400 },
    sourceUrl: { type: String, trim: true },
  },
  { _id: false },
);

/**
 * A cached cure/guarantee-scanner hit (mirrors `lib/content-flags.ts`
 * `ContentFlag`). Stored on a record so moderators see flags in the review
 * queue and the approval gate can require each be acknowledged.
 */
export interface IContentFlag {
  phrase: string;
  context: string;
}

export const contentFlagSchema = new Schema<IContentFlag>(
  {
    phrase: { type: String, required: true },
    context: { type: String, default: "" },
  },
  { _id: false },
);

// ── Spam classification (public-form guard) ─────────────────────────────────

/**
 * The classifier's reasoning, stored alongside a *kept* submission (`allow` or
 * `quarantine`). Rejected payloads go to `BlockedSubmission` instead.
 *
 * `reasons` is stored, not just the score, because an operator who cannot see
 * *why* something was flagged cannot correct it — and correcting it is the only
 * way the filter ever improves.
 */
export interface ISpamMeta {
  /** "allow" | "quarantine" — a rejected payload is never written here. */
  verdict: string;
  score: number;
  category?: string | null;
  reasons: Array<{ code: string; detail: string; weight: number }>;
  /**
   * Hash of the human-written fields only (the email is deliberately excluded).
   * Floods replay one payload across many harvested addresses, so hashing the
   * address would make every copy look unique.
   */
  payloadHash?: string;
  /** Cleared when an operator marks something "not spam". */
  checkedAt?: Date | null;
  /** Set when a human overrode the machine, so backfills never re-flag it. */
  overriddenBy?: Types.ObjectId | null;
  overriddenAt?: Date | null;
}

export const spamMetaSchema = new Schema<ISpamMeta>(
  {
    verdict: { type: String, required: true },
    score: { type: Number, required: true, default: 0 },
    category: { type: String, default: null },
    reasons: {
      type: [
        new Schema(
          {
            code: { type: String, required: true },
            detail: { type: String, required: true },
            weight: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    payloadHash: { type: String, default: undefined },
    checkedAt: { type: Date, default: null },
    overriddenBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    overriddenAt: { type: Date, default: null },
  },
  { _id: false },
);

// ── Soft-delete plugin ──────────────────────────────────────────────────────

/**
 * Adds `isDeleted` + `deletedAt` and `softDelete()` / `restore()` instance
 * helpers. Intentionally does NOT add a global query filter — admin modules
 * need to see soft-deleted rows; public queries filter `{ isDeleted: false }`
 * explicitly. Applied to Clinic, Review, User (PRD §5 intro).
 */
export function softDeletePlugin(schema: Schema): void {
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  });

  schema.methods.softDelete = function softDelete(
    this: HydratedDocument<unknown>,
  ) {
    this.set({ isDeleted: true, deletedAt: new Date() });
    return this.save();
  };

  schema.methods.restore = function restore(this: HydratedDocument<unknown>) {
    this.set({ isDeleted: false, deletedAt: null });
    return this.save();
  };
}

// ── Serialization helpers ───────────────────────────────────────────────────

/**
 * Convert a Mongoose sub-document to a plain, spreadable object.
 *
 * Spreading a *hydrated* sub-document (`{ ...doc.subfield }`) is a trap on two
 * counts: it copies Mongoose internals (`$__`, `_doc`, `$__parent`, …) — class
 * instances that break React Server Component serialization ("Only plain
 * objects … can be passed to Client Components") — while NOT copying the
 * schema-path values, which live on the prototype as getters, so any merge
 * defaults silently win over the real DB values. `.toObject()` returns the
 * stored values as plain data. Lean/plain inputs pass through unchanged.
 */
export function toPlainObject<T extends object>(
  value: T | null | undefined,
): Partial<T> {
  if (!value) return {};
  const doc = value as { toObject?: () => Partial<T> };
  return typeof doc.toObject === "function" ? doc.toObject() : { ...value };
}

// ── Model registration ──────────────────────────────────────────────────────

/**
 * Idempotent model factory. Returns the already-registered model when present
 * (hot reload / warm lambda), otherwise compiles and registers it.
 */
export function registerModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (models[name] as Model<T>) || model<T>(name, schema);
}
