/**
 * Plan — listing tier config (PRD §5.7 / Stage 1.7).
 *
 * Drives the `/for-clinics` pricing table and badge logic. Display-only in MVP
 * (no Stripe — PRD §16/Q4); `tier` on a clinic is set by admins, not billing.
 */
import { Schema, type Types } from "mongoose";
import { PLAN_KEYS, type PlanKey } from "@/lib/enums";
import { registerModel, type TimestampFields } from "@/models/_shared";

export interface IPlan extends TimestampFields {
  _id: Types.ObjectId;
  key: PlanKey;
  name: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  currency: string;
  features: string[];
  badge?: string;
  /** Highlight as the "most popular" column on `/for-clinics`. */
  highlighted: boolean;
  isActive: boolean;
  ctaLabel?: string;
  order: number;
}

const PlanSchema = new Schema<IPlan>(
  {
    key: { type: String, enum: PLAN_KEYS, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priceMonthly: { type: Number, min: 0 },
    priceYearly: { type: Number, min: 0 },
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    features: { type: [String], default: [] },
    badge: { type: String, trim: true },
    highlighted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    ctaLabel: { type: String, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

PlanSchema.index({ order: 1 });

export const Plan = registerModel<IPlan>("Plan", PlanSchema);
export default Plan;
