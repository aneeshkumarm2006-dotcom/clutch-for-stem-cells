/**
 * Lead — consultation request / quote / match (PRD §5.4 / Stage 1.4).
 *
 * `clinicId` is null for matching-wizard leads (`type: 'match'`), where
 * `matchedClinicIds` holds the computed shortlist (PRD §6.5). Not soft-deleted
 * (PRD §5 lists soft-delete for clinics/reviews/users only); spam is a
 * status value instead.
 */
import { Schema, type Types } from "mongoose";
import { LEAD_STATUSES, LEAD_TIMEFRAMES, LEAD_TYPES } from "@/lib/enums";
import type { LeadStatus, LeadTimeframe, LeadType } from "@/lib/enums";
import { registerModel, type TimestampFields } from "@/models/_shared";

export interface ILeadNote {
  _id?: Types.ObjectId;
  note: string;
  byUserId?: Types.ObjectId;
  at: Date;
}

export interface ILead extends TimestampFields {
  _id: Types.ObjectId;
  type: LeadType;
  clinicId?: Types.ObjectId | null;
  matchedClinicIds: Types.ObjectId[];
  name: string;
  email: string;
  phone?: string;
  country?: string;
  conditionId?: Types.ObjectId;
  treatmentInterest: Types.ObjectId[];
  budgetRange?: string;
  timeframe?: LeadTimeframe;
  message?: string;
  /** §14: privacy/medical consent — required true at submission. */
  consentGiven: boolean;
  /** §8.6: submitter confirmed 18+ (or guardian). */
  ageConfirmed: boolean;
  status: LeadStatus;
  source?: string;
  assignedTo?: Types.ObjectId | null;
  internalNotes: ILeadNote[];
}

const leadNoteSchema = new Schema<ILeadNote>({
  note: { type: String, required: true, trim: true },
  byUserId: { type: Schema.Types.ObjectId, ref: "User" },
  at: { type: Date, default: () => new Date() },
});

const LeadSchema = new Schema<ILead>(
  {
    type: { type: String, enum: LEAD_TYPES, required: true, index: true },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      default: null,
      index: true,
    },
    matchedClinicIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Clinic" }],
      default: [],
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },
    conditionId: { type: Schema.Types.ObjectId, ref: "Condition" },
    treatmentInterest: {
      type: [{ type: Schema.Types.ObjectId, ref: "Treatment" }],
      default: [],
    },
    budgetRange: { type: String, trim: true },
    timeframe: { type: String, enum: LEAD_TIMEFRAMES },
    message: { type: String, trim: true },
    consentGiven: { type: Boolean, default: false },
    ageConfirmed: { type: Boolean, default: false },
    status: { type: String, enum: LEAD_STATUSES, default: "new", index: true },
    source: { type: String, trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    internalNotes: { type: [leadNoteSchema], default: [] },
  },
  { timestamps: true },
);

// Admin leads table: newest first, filterable by status/assignment.
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ assignedTo: 1, status: 1 });

export const Lead = registerModel<ILead>("Lead", LeadSchema);
export default Lead;
