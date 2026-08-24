/**
 * EmailCapture — one address handed over through the guide-capture modal.
 *
 * The modal (`components/shortlist/guide-capture-modal.tsx`) fires once a
 * visitor has looked at a second clinic profile, or the moment they save a
 * clinic to their shortlist, and offers to email their shortlist plus the 12
 * questions to ask any clinic. Every submission lands here, with the whole
 * context around it, so `/admin/captures` can answer "which trigger produced
 * this address, what was in their shortlist, and did the email actually go
 * out" without a second system.
 *
 * Two independent state fields, deliberately:
 *
 *   `status`   — what an operator decided about the record (new / archived /
 *                unsubscribed / spam).
 *   `delivery` — what SMTP did with the one guide email we owe them. A record
 *                can be perfectly good and still sit at `failed`.
 *
 * PII lives here (an email address, by definition) and nowhere public. No IP is
 * stored: rate limiting sees it, the record doesn't need it.
 */
import { Schema, type Types } from "mongoose";

import {
  CAPTURE_DELIVERY_STATES,
  CAPTURE_STATUSES,
  CAPTURE_TRIGGERS,
} from "@/lib/enums";
import type {
  CaptureDelivery,
  CaptureStatus,
  CaptureTrigger,
} from "@/lib/enums";
import {
  registerModel,
  spamMetaSchema,
  type ISpamMeta,
  type TimestampFields,
} from "@/models/_shared";

/** Campaign attribution, read off the landing URL by the modal. */
export interface ICaptureUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface IEmailCapture extends TimestampFields {
  _id: Types.ObjectId;
  email: string;
  trigger: CaptureTrigger;
  /**
   * Shortlist slugs exactly as the browser held them. Kept verbatim (rather
   * than only the resolved ids) so a slug that was renamed or unpublished
   * between capture and review is still visible instead of vanishing.
   */
  shortlistSlugs: string[];
  /** The subset that resolved to a live published clinic at capture time. */
  clinicIds: Types.ObjectId[];
  shortlistCount: number;
  /** Distinct clinic profiles this browser had opened when the modal fired. */
  profileViewCount?: number;
  /** Page the modal was submitted from. */
  path?: string;
  referrer?: string;
  utm?: ICaptureUtm;
  status: CaptureStatus;
  delivery: CaptureDelivery;
  sentAt?: Date | null;
  /** Last SMTP error, for the admin row. Cleared on a successful resend. */
  deliveryError?: string;
  /**
   * When the owner notification went out. Null means the team was never told
   * about this signup, which is worth seeing in the queue: the subscriber may
   * have their guide while nobody here knows they exist.
   */
  ownerNotifiedAt?: Date | null;
  resendCount: number;
  spam?: ISpamMeta;
  internalNote?: string;
}

const captureUtmSchema = new Schema<ICaptureUtm>(
  {
    source: { type: String, trim: true },
    medium: { type: String, trim: true },
    campaign: { type: String, trim: true },
    term: { type: String, trim: true },
    content: { type: String, trim: true },
  },
  { _id: false },
);

const EmailCaptureSchema = new Schema<IEmailCapture>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    trigger: { type: String, enum: CAPTURE_TRIGGERS, required: true, index: true },
    shortlistSlugs: { type: [String], default: [] },
    clinicIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Clinic" }],
      default: [],
    },
    shortlistCount: { type: Number, default: 0 },
    profileViewCount: { type: Number },
    path: { type: String, trim: true },
    referrer: { type: String, trim: true },
    utm: { type: captureUtmSchema, default: undefined },
    status: {
      type: String,
      enum: CAPTURE_STATUSES,
      default: "new",
      index: true,
    },
    delivery: {
      type: String,
      enum: CAPTURE_DELIVERY_STATES,
      default: "pending",
      index: true,
    },
    sentAt: { type: Date, default: null },
    deliveryError: { type: String, trim: true },
    ownerNotifiedAt: { type: Date, default: null },
    resendCount: { type: Number, default: 0 },
    spam: { type: spamMetaSchema, default: undefined },
    internalNote: { type: String, trim: true },
  },
  { timestamps: true },
);

// Admin list: newest first within a status tab.
EmailCaptureSchema.index({ status: 1, createdAt: -1 });
// "Has this address already been captured?" and the per-address history panel.
EmailCaptureSchema.index({ email: 1, createdAt: -1 });

export const EmailCapture = registerModel<IEmailCapture>(
  "EmailCapture",
  EmailCaptureSchema,
);
export default EmailCapture;
