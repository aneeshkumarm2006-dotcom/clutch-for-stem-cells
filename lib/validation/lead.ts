/**
 * Lead validation (PRD §5.4 / Stage 1.10).
 *
 * `leadCreateSchema` is the public form (consultation/quote/match/contact —
 * consent required). `leadUpdateSchema` is the admin workflow (status,
 * assignment, notes).
 */
import { z } from "zod";
import { LEAD_STATUSES, LEAD_TIMEFRAMES, LEAD_TYPES } from "@/lib/enums";
import { consentTrueSchema, objectIdSchema } from "@/lib/validation/common";

export const leadCreateSchema = z.object({
  type: z.enum(LEAD_TYPES).default("consultation"),
  clinicId: objectIdSchema.nullish(),
  matchedClinicIds: z.array(objectIdSchema).default([]),
  name: z.string().min(1, "Name is required").max(160),
  email: z.string().email("A valid email is required"),
  phone: z.string().max(40).optional(),
  country: z.string().max(120).optional(),
  conditionId: objectIdSchema.optional(),
  treatmentInterest: z.array(objectIdSchema).default([]),
  budgetRange: z.string().max(120).optional(),
  timeframe: z.enum(LEAD_TIMEFRAMES).optional(),
  message: z.string().max(5000).optional(),
  // Compliance gates (PRD §14, §8.6).
  consentGiven: consentTrueSchema,
  ageConfirmed: z.boolean().default(false),
  source: z.string().max(200).optional(),
});

const leadNoteSchema = z.object({
  note: z.string().min(1).max(4000),
  byUserId: objectIdSchema.optional(),
});

/** Admin lead workflow — status, assignment, internal notes (§8.4). */
export const leadUpdateSchema = z
  .object({
    status: z.enum(LEAD_STATUSES),
    assignedTo: objectIdSchema.nullish(),
    internalNotes: z.array(leadNoteSchema),
  })
  .partial();

export type LeadInput = z.infer<typeof leadCreateSchema>;
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;
