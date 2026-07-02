/**
 * MatrixPage — the editorial content record behind a programmatic combination
 * page (treatment×condition, treatment×country, condition×country).
 *
 * Combination URLs are **authored-into-existence**: a page exists only when an
 * `approved` MatrixPage exists for it (see `generateStaticParams` on the combo
 * routes + `isMatrixIndexable`). This holds the unique, human-reviewed delta for
 * one combination; the reusable frame (treatment mechanism, condition
 * standard-of-care, country regulatory context) composes from the enriched
 * taxonomy terms at render time.
 *
 * `body` is **sanitized HTML** (Tiptap output, cleaned on save via
 * `lib/seoteam/sanitize.ts`); `intro` is plain-text (the answer-first TL;DR).
 * Authored in the `/seoteam` CMS behind the shared-password session, and gated
 * by the same review lifecycle as taxonomy enrichment (`lib/content-review.ts`).
 */
import { Schema, type Types } from "mongoose";

import {
  CONTENT_REVIEW_STATUSES,
  MATRIX_KINDS,
  type ContentReviewStatus,
  type MatrixKind,
} from "@/lib/enums";
import {
  seoSchema,
  faqSchema,
  keyFactSchema,
  contentFlagSchema,
  registerModel,
  type ISeo,
  type IFaqEntry,
  type IKeyFact,
  type IContentFlag,
  type TimestampFields,
} from "@/models/_shared";

export interface IMatrixPage extends TimestampFields {
  _id: Types.ObjectId;
  kind: MatrixKind;
  /** Primary axis slug (treatment for T×*, condition for condition×country). */
  slugA: string;
  /** Secondary axis slug (condition, or country for *×country). */
  slugB: string;
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  seo?: ISeo;
  /** Answer-first TL;DR (plain text, 40–60 words) — the highest-risk quote. */
  intro?: string;
  /** Sanitized HTML long-form body. */
  body?: string;
  faqs: IFaqEntry[];
  keyFacts: IKeyFact[];
  reviewStatus: ContentReviewStatus;
  reviewedBy?: Types.ObjectId | null;
  lastReviewedAt?: Date | null;
  publishedAt?: Date | null;
  contentFlags: IContentFlag[];
  flagsAcknowledged: boolean;
}

const MatrixPageSchema = new Schema<IMatrixPage>(
  {
    kind: { type: String, enum: MATRIX_KINDS, required: true },
    slugA: { type: String, required: true, lowercase: true, trim: true },
    slugB: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    metaTitle: { type: String, trim: true, maxlength: 120 },
    metaDescription: { type: String, trim: true, maxlength: 320 },
    seo: { type: seoSchema, default: undefined },
    intro: { type: String },
    body: { type: String, default: "" },
    faqs: { type: [faqSchema], default: [] },
    keyFacts: { type: [keyFactSchema], default: [] },
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

// One record per combination (the URL identity).
MatrixPageSchema.index({ kind: 1, slugA: 1, slugB: 1 }, { unique: true });
// Public/sitemap read: approved records of a kind.
MatrixPageSchema.index({ reviewStatus: 1, kind: 1 });

export const MatrixPage = registerModel<IMatrixPage>(
  "MatrixPage",
  MatrixPageSchema,
);
export default MatrixPage;
