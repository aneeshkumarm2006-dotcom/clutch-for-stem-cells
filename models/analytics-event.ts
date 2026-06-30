/**
 * AnalyticsEvent — durable, privacy-safe event store (Stage 9.2 / PRD §15).
 *
 * The MVP analytics sink (`lib/analytics.ts`) writes events here so the admin can
 * surface per-clinic metrics (Stage 9.3) without a third-party warehouse. Events
 * carry **no PII** (PRD §13): a coarse event `name`, an optional `clinicId`, and a
 * small bag of non-identifying numeric/string `props` (counts, hostnames). Raw
 * events auto-expire via a TTL index so the collection stays bounded — aggregate
 * dashboards read recent windows, not the full history.
 */
import { Schema, type Types } from "mongoose";
import { registerModel } from "@/models/_shared";

/** Allowlisted event names — keeps the store tidy and the admin views typed. */
export const ANALYTICS_EVENT_NAMES = [
  "profile_view",
  "filter_use",
  "outbound_click",
  "lead_submit",
  "review_submit",
  "search",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

/** Raw events older than this are dropped by the TTL index (~180 days). */
export const ANALYTICS_TTL_SECONDS = 180 * 24 * 60 * 60;

export interface IAnalyticsEvent {
  _id: Types.ObjectId;
  name: AnalyticsEventName;
  /** Clinic the event relates to, when applicable (profile view, outbound, lead). */
  clinicId?: Types.ObjectId | null;
  /** Non-identifying metadata only — never emails, IPs, or free-text PII. */
  props?: Record<string, unknown>;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    name: { type: String, required: true, index: true },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      default: null,
      index: true,
    },
    props: { type: Schema.Types.Mixed, default: {} },
    // Own `createdAt` (not `timestamps`) so the TTL index has a clean target.
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Per-clinic time-window queries (Stage 9.3 admin dashboards).
AnalyticsEventSchema.index({ clinicId: 1, name: 1, createdAt: -1 });
// Auto-expire raw events to keep the collection bounded.
AnalyticsEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: ANALYTICS_TTL_SECONDS },
);

export const AnalyticsEvent = registerModel<IAnalyticsEvent>(
  "AnalyticsEvent",
  AnalyticsEventSchema,
);
export default AnalyticsEvent;
