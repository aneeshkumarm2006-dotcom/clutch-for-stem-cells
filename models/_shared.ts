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

/** Per-document SEO overrides (PRD §5.1, §11). Defaults come from SiteSetting. */
export interface ISeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  noindex?: boolean;
}

export const seoSchema = new Schema<ISeo>(
  {
    metaTitle: { type: String, trim: true, maxlength: 120 },
    metaDescription: { type: String, trim: true, maxlength: 320 },
    ogImage: { type: String, trim: true },
    canonicalUrl: { type: String, trim: true },
    noindex: { type: Boolean, default: false },
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

// ── Soft-delete plugin ──────────────────────────────────────────────────────

/**
 * Adds `isDeleted` + `deletedAt` and `softDelete()` / `restore()` instance
 * helpers. Intentionally does NOT add a global query filter — admin modules
 * need to see soft-deleted rows; public queries filter `{ isDeleted: false }`
 * explicitly. Applied to Clinic, Review, Article, User (PRD §5 intro).
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
