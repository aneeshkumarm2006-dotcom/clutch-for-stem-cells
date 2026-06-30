/**
 * Report / flag validation (PRD §14 / Stage 8.7).
 *
 * `reportCreateSchema` is the public flag submission (entity + reason, optional
 * details/email). `reportUpdateSchema` covers admin triage (status + note).
 */
import { z } from "zod";
import {
  REPORT_ENTITY_TYPES,
  REPORT_REASONS,
  REPORT_STATUSES,
} from "@/lib/enums";
import { objectIdSchema } from "@/lib/validation/common";

export const reportCreateSchema = z.object({
  entityType: z.enum(REPORT_ENTITY_TYPES),
  entityId: objectIdSchema,
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(2000).optional(),
  // Optional follow-up contact — kept private (PRD §14).
  reporterEmail: z
    .string()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
});

export const reportUpdateSchema = z.object({
  status: z.enum(REPORT_STATUSES),
  resolutionNote: z.string().max(2000).optional(),
});

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;
