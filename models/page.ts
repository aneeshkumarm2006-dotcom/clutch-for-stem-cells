/**
 * Page — an editor-composed page, built from an ordered list of reusable blocks.
 *
 * This is the modular-content vehicle: instead of a fixed form, a non-technical
 * editor composes the page from blocks (rich text, FAQ, comparison table, …) in
 * the `/seoteam` CMS. Blocks that carry structured meaning auto-wire into the
 * schema engine (`lib/blocks/schema.ts`), so composing the page *is* how you get
 * its structured data.
 *
 * Greenfield and additive — no existing content moves into it, so nothing can
 * break. Existing fixed-form content types (Clinic, BlogPost, MatrixPage,
 * taxonomy) keep working exactly as they do today.
 *
 * Lifecycle reuses the YMYL editorial gate shared with taxonomy + MatrixPage
 * (`lib/content-review.ts`): only an `approved` page is public and indexable,
 * and approval requires a reviewer plus acknowledged content flags.
 *
 * Blocks holding HTML are sanitized on save; `data` shapes are validated by the
 * discriminated union in `lib/validation/block.ts`.
 */
import { Schema, type Types } from "mongoose";

import { CONTENT_REVIEW_STATUSES, type ContentReviewStatus } from "@/lib/enums";
import {
  blockSchema,
  contentFlagSchema,
  registerModel,
  schemaOverrideSchema,
  seoSchema,
  type IBlock,
  type IContentFlag,
  type ISchemaOverrides,
  type ISeo,
  type TimestampFields,
} from "@/models/_shared";

export interface IPage extends TimestampFields {
  _id: Types.ObjectId;
  title: string;
  /** The page's URL segment — served at `/{slug}` (see the reserved-slug guard). */
  slug: string;
  /** Answer-first summary rendered above the blocks (plain text). */
  intro?: string;
  /** The ordered composition. */
  blocks: IBlock[];
  /** Per-page SEO override (meta/OG/Twitter/robots/canonical/focus keyword). */
  seo?: ISeo;
  /** Per-page control over the auto-generated JSON-LD. */
  schemaOverrides?: ISchemaOverrides;
  /** Only `approved` is public — the shared editorial gate. */
  reviewStatus: ContentReviewStatus;
  reviewedBy?: Types.ObjectId | null;
  lastReviewedAt?: Date | null;
  publishedAt?: Date | null;
  contentFlags: IContentFlag[];
  flagsAcknowledged: boolean;
}

const PageSchema = new Schema<IPage>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    intro: { type: String },
    blocks: { type: [blockSchema], default: [] },
    seo: { type: seoSchema, default: undefined },
    schemaOverrides: { type: schemaOverrideSchema, default: undefined },
    reviewStatus: {
      type: String,
      enum: CONTENT_REVIEW_STATUSES,
      default: "draft",
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "MedicalReviewer",
      default: null,
    },
    lastReviewedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    contentFlags: { type: [contentFlagSchema], default: [] },
    flagsAcknowledged: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Public + sitemap read: approved pages, newest first.
PageSchema.index({ reviewStatus: 1, publishedAt: -1 });
// CMS list search.
PageSchema.index({ title: "text" }, { name: "page_title_text" });

export const Page = registerModel<IPage>("Page", PageSchema);
export default Page;
