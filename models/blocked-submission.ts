/**
 * BlockedSubmission — the bin behind every hard reject.
 *
 * A `reject` verdict means the payload never reaches `Lead`/`Review`/`Report`.
 * That is only defensible because a verbatim copy lands here first, visible at
 * `/admin/spam`, for 30 days. Without the bin one false positive silently
 * destroys a customer and nobody ever finds out; the bin is what earns the
 * right to reject anything at all.
 *
 * Records expire automatically via a TTL index on `expiresAt` — no purge job,
 * and no unbounded growth from a sustained flood.
 *
 * The stored payload is raw submitter input. It is only ever rendered inside
 * `/admin/spam` (escaped by React, never `dangerouslySetInnerHTML`) and is
 * excluded from every public read path.
 */
import { Schema, type Types } from "mongoose";

import { BLOCKED_RETENTION_DAYS } from "@/config/spam";
import { registerModel, type TimestampFields } from "@/models/_shared";
import type { SpamCategory, SpamReason } from "@/lib/spam/types";

/** Which public form the rejected payload came from. */
export const BLOCKED_FORMS = ["lead", "review", "report"] as const;
export type BlockedForm = (typeof BLOCKED_FORMS)[number];

export interface IBlockedReason {
  code: string;
  detail: string;
  weight: number;
}

export interface IBlockedSubmission extends TimestampFields {
  _id: Types.ObjectId;
  form: BlockedForm;
  /** Total classifier score at the time of the decision. */
  score: number;
  category?: SpamCategory | null;
  /** Every rule that fired — shown on the row so an operator can judge it. */
  reasons: IBlockedReason[];
  /** The submitted body, verbatim, so a false positive can be recovered. */
  payload: Record<string, unknown>;
  ip?: string;
  subnet?: string | null;
  userAgent?: string;
  /** Hash of the human-written fields — powers duplicate detection. */
  payloadHash?: string;
  /** Set when an operator rescued this as a false positive. */
  restoredAt?: Date | null;
  restoredBy?: Types.ObjectId | null;
  /** TTL anchor — Mongo removes the document once this passes. */
  expiresAt: Date;
}

const blockedReasonSchema = new Schema<IBlockedReason>(
  {
    code: { type: String, required: true },
    detail: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false },
);

const BlockedSubmissionSchema = new Schema<IBlockedSubmission>(
  {
    form: { type: String, enum: BLOCKED_FORMS, required: true, index: true },
    score: { type: Number, required: true },
    category: { type: String, default: null, index: true },
    reasons: { type: [blockedReasonSchema], default: [] },
    payload: { type: Schema.Types.Mixed, default: () => ({}) },
    ip: { type: String, trim: true },
    subnet: { type: String, trim: true, default: null },
    userAgent: { type: String, trim: true },
    payloadHash: { type: String, index: true },
    restoredAt: { type: Date, default: null },
    restoredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: {
      type: Date,
      required: true,
      default: () =>
        new Date(Date.now() + BLOCKED_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true },
);

// Mongo's TTL monitor drops documents once `expiresAt` is in the past.
BlockedSubmissionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Admin queue: newest first, filterable by form.
BlockedSubmissionSchema.index({ form: 1, createdAt: -1 });

export const BlockedSubmission = registerModel<IBlockedSubmission>(
  "BlockedSubmission",
  BlockedSubmissionSchema,
);
export default BlockedSubmission;

/** Narrow a classifier reason to the stored shape. */
export function toBlockedReasons(reasons: SpamReason[]): IBlockedReason[] {
  return reasons.map((r) => ({
    code: r.code,
    detail: r.detail,
    weight: r.weight,
  }));
}
