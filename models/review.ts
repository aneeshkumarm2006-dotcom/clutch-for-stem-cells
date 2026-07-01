/**
 * Review — patient review/testimonial (PRD §5.2 / Stage 1.2).
 *
 * Defaults to `pending` (never auto-publish — PRD §16/Q6). `reviewer.email` is
 * private (`select: false`) and never rendered publicly (PRD §5.2, §14).
 * Approving a review triggers a clinic rating recompute (Stage 3.2 / §8.3).
 */
import { Schema, type Types } from "mongoose";
import { REVIEW_STATUSES, REVIEW_VERIFICATION_METHODS } from "@/lib/enums";
import type { ReviewStatus, ReviewVerificationMethod } from "@/lib/enums";
import {
  softDeletePlugin,
  registerModel,
  type SoftDeleteFields,
  type TimestampFields,
} from "@/models/_shared";

// ── Sub-document interfaces ─────────────────────────────────────────────────

export interface IReviewer {
  displayName?: string;
  isAnonymous: boolean;
  /** Private — never exposed publicly (PRD §5.2, §14). */
  email?: string;
  country?: string;
  ageRange?: string;
}

export interface IReviewCost {
  range?: string;
  currency?: string;
  isConfidential: boolean;
}

export interface IReviewRatings {
  outcome?: number;
  communication?: number;
  facility?: number;
  value?: number;
  refer?: number;
}

/** Structured body (PRD §5.2) — mirrors Clutch's review schema, adapted. */
export interface IReviewBody {
  condition?: string;
  whyChosen?: string;
  treatmentDescription?: string;
  outcome?: string;
  experience?: string;
  improvement?: string;
}

export interface IProviderResponse {
  body: string;
  respondedAt?: Date;
  byUserId?: Types.ObjectId;
}

export interface IModeration {
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  notes?: string;
  rejectionReason?: string;
}

export interface IReview extends TimestampFields, SoftDeleteFields {
  _id: Types.ObjectId;
  clinicId: Types.ObjectId;
  status: ReviewStatus;
  isVerified: boolean;
  verificationMethod?: ReviewVerificationMethod;
  reviewer: IReviewer;
  conditionId?: Types.ObjectId;
  treatmentId?: Types.ObjectId;
  treatmentDate?: string;
  cost?: IReviewCost;
  ratingOverall: number;
  ratings: IReviewRatings;
  headline?: string;
  body: IReviewBody;
  /** "Why chosen" multi-select tags — feed `Clinic.topMentions` (PRD §5.2). */
  whyChosenTags: string[];
  wouldRecommend?: boolean;
  helpfulCount: number;
  providerResponse?: IProviderResponse;
  moderation?: IModeration;
  /** §8.6: submitter confirmed 18+ (compliance gate, not in §5.2 table). */
  ageConfirmed: boolean;
  /** §14: agreed to terms/privacy & "not medical advice". */
  consentGiven: boolean;
}

// ── Sub-schemas ─────────────────────────────────────────────────────────────

const reviewerSchema = new Schema<IReviewer>(
  {
    displayName: { type: String, trim: true },
    isAnonymous: { type: Boolean, default: false },
    // Private contact — excluded from query results by default.
    email: { type: String, trim: true, lowercase: true, select: false },
    country: { type: String, trim: true },
    ageRange: { type: String, trim: true },
  },
  { _id: false },
);

const reviewCostSchema = new Schema<IReviewCost>(
  {
    range: { type: String, trim: true },
    currency: { type: String, trim: true, uppercase: true },
    isConfidential: { type: Boolean, default: false },
  },
  { _id: false },
);

const reviewRatingsSchema = new Schema<IReviewRatings>(
  {
    outcome: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    facility: { type: Number, min: 1, max: 5 },
    value: { type: Number, min: 1, max: 5 },
    refer: { type: Number, min: 1, max: 5 },
  },
  { _id: false },
);

const reviewBodySchema = new Schema<IReviewBody>(
  {
    condition: { type: String, trim: true },
    whyChosen: { type: String, trim: true },
    treatmentDescription: { type: String, trim: true },
    outcome: { type: String, trim: true },
    experience: { type: String, trim: true },
    improvement: { type: String, trim: true },
  },
  { _id: false },
);

const providerResponseSchema = new Schema<IProviderResponse>(
  {
    body: { type: String, required: true, trim: true },
    respondedAt: { type: Date },
    byUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false },
);

const moderationSchema = new Schema<IModeration>(
  {
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    notes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
  },
  { _id: false },
);

// ── Review schema ───────────────────────────────────────────────────────────

const ReviewSchema = new Schema<IReview>(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: REVIEW_STATUSES,
      default: "pending",
      index: true,
    },
    isVerified: { type: Boolean, default: false },
    verificationMethod: { type: String, enum: REVIEW_VERIFICATION_METHODS },
    reviewer: { type: reviewerSchema, required: true },
    conditionId: { type: Schema.Types.ObjectId, ref: "Condition" },
    treatmentId: { type: Schema.Types.ObjectId, ref: "Treatment" },
    treatmentDate: { type: String, trim: true },
    cost: { type: reviewCostSchema, default: undefined },
    ratingOverall: { type: Number, required: true, min: 1, max: 5 },
    ratings: { type: reviewRatingsSchema, default: () => ({}) },
    headline: { type: String, trim: true, maxlength: 160 },
    body: { type: reviewBodySchema, default: () => ({}) },
    whyChosenTags: { type: [String], default: [] },
    wouldRecommend: { type: Boolean },
    helpfulCount: { type: Number, default: 0, min: 0 },
    providerResponse: { type: providerResponseSchema, default: undefined },
    moderation: { type: moderationSchema, default: undefined },
    ageConfirmed: { type: Boolean, default: false },
    consentGiven: { type: Boolean, default: false },
  },
  { timestamps: true },
);

softDeletePlugin(ReviewSchema);

// ── Indexes ─────────────────────────────────────────────────────────────────
// Hot path: a clinic's approved, non-deleted reviews, newest first.
ReviewSchema.index({ clinicId: 1, status: 1, isDeleted: 1, createdAt: -1 });
// Moderation queue: pending first, oldest first.
ReviewSchema.index({ status: 1, createdAt: 1 });

export const Review = registerModel<IReview>("Review", ReviewSchema);
export default Review;
