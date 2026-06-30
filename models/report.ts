/**
 * Report — a user-submitted flag on a review or clinic (PRD §14 / Stage 8.7).
 *
 * Public, unauthenticated submissions ("report this review/clinic") land here as
 * `open` and surface in the `/admin/reports` moderation queue. Reporter email is
 * optional and **private** (`select: false`) — used only for follow-up, never
 * shown publicly (PRD §14). Not soft-deleted: a flag is resolved/dismissed via
 * `status`, mirroring `Lead`.
 */
import { Schema, type Types } from "mongoose";
import {
  REPORT_ENTITY_TYPES,
  REPORT_REASONS,
  REPORT_STATUSES,
} from "@/lib/enums";
import type { ReportEntityType, ReportReason, ReportStatus } from "@/lib/enums";
import { registerModel, type TimestampFields } from "@/models/_shared";

export interface IReport extends TimestampFields {
  _id: Types.ObjectId;
  entityType: ReportEntityType;
  /** The flagged Review or Clinic id. */
  entityId: Types.ObjectId;
  /** Denormalized clinic id for fast queue grouping (= entityId for clinics). */
  clinicId?: Types.ObjectId | null;
  reason: ReportReason;
  details?: string;
  /** Optional reporter contact — private, never rendered publicly. */
  reporterEmail?: string;
  status: ReportStatus;
  resolvedBy?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  /** Internal moderator note on the resolution. */
  resolutionNote?: string;
}

const ReportSchema = new Schema<IReport>(
  {
    entityType: {
      type: String,
      enum: REPORT_ENTITY_TYPES,
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      default: null,
      index: true,
    },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 2000 },
    // Private contact — excluded from query results by default.
    reporterEmail: { type: String, trim: true, lowercase: true, select: false },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: "open",
      index: true,
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

// Admin queue: open flags first, newest first.
ReportSchema.index({ status: 1, createdAt: -1 });

export const Report = registerModel<IReport>("Report", ReportSchema);
export default Report;
