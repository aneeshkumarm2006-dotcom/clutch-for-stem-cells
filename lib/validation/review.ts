/**
 * Review validation (PRD §5.2 / Stage 1.10).
 *
 * `reviewSubmitSchema` is the public submission (email + consent + 18+ required;
 * always enters as `pending`). `reviewUpdateSchema` covers admin moderation
 * (status, verification, provider response).
 */
import { z } from "zod";
import { REVIEW_STATUSES, REVIEW_VERIFICATION_METHODS } from "@/lib/enums";
import {
  ageConfirmedSchema,
  consentTrueSchema,
  currencySchema,
  objectIdSchema,
  ratingValueSchema,
} from "@/lib/validation/common";

const reviewRatingsSchema = z
  .object({
    outcome: ratingValueSchema.optional(),
    communication: ratingValueSchema.optional(),
    facility: ratingValueSchema.optional(),
    value: ratingValueSchema.optional(),
    refer: ratingValueSchema.optional(),
  })
  .partial();

const reviewBodySchema = z
  .object({
    condition: z.string().max(4000).optional(),
    whyChosen: z.string().max(4000).optional(),
    treatmentDescription: z.string().max(4000).optional(),
    outcome: z.string().max(4000).optional(),
    experience: z.string().max(4000).optional(),
    improvement: z.string().max(4000).optional(),
  })
  .partial();

const reviewCostSchema = z.object({
  range: z.string().max(120).optional(),
  currency: currencySchema.optional(),
  isConfidential: z.boolean().default(false),
});

const reviewerSchema = z.object({
  displayName: z.string().max(120).optional(),
  isAnonymous: z.boolean().default(false),
  // Private — used for verification + lead routing only, never shown publicly.
  email: z.string().email("A valid email is required"),
  country: z.string().max(120).optional(),
  ageRange: z.string().max(40).optional(),
});

export const reviewSubmitSchema = z.object({
  clinicId: objectIdSchema,
  conditionId: objectIdSchema.optional(),
  treatmentId: objectIdSchema.optional(),
  treatmentDate: z.string().max(120).optional(),
  cost: reviewCostSchema.optional(),
  ratingOverall: ratingValueSchema,
  ratings: reviewRatingsSchema.default({}),
  headline: z.string().max(160).optional(),
  body: reviewBodySchema.default({}),
  whyChosenTags: z.array(z.string().max(60)).default([]),
  reviewer: reviewerSchema,
  wouldRecommend: z.boolean().optional(),
  // Compliance gates (PRD §14, §8.6).
  consentGiven: consentTrueSchema,
  ageConfirmed: ageConfirmedSchema,
});

const providerResponseSchema = z.object({
  body: z.string().min(1).max(4000),
  respondedAt: z.coerce.date().optional(),
  byUserId: objectIdSchema.optional(),
});

const moderationSchema = z.object({
  reviewedBy: objectIdSchema.optional(),
  reviewedAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(2000).optional(),
});

/** Admin moderation/edit — all fields optional (PATCH semantics, §8.3). */
export const reviewUpdateSchema = z
  .object({
    status: z.enum(REVIEW_STATUSES),
    isVerified: z.boolean(),
    verificationMethod: z.enum(REVIEW_VERIFICATION_METHODS),
    treatmentDate: z.string().max(120),
    cost: reviewCostSchema,
    ratingOverall: ratingValueSchema,
    ratings: reviewRatingsSchema,
    headline: z.string().max(160),
    body: reviewBodySchema,
    whyChosenTags: z.array(z.string().max(60)),
    wouldRecommend: z.boolean(),
    providerResponse: providerResponseSchema,
    moderation: moderationSchema,
  })
  .partial();

export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
