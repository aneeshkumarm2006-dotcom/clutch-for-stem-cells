/**
 * AuditLog validation (PRD §5.9 / Stage 1.10). Written server-side by
 * `/lib/audit.ts` (Stage 3.8); this guards the shape of an entry.
 */
import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

export const auditLogCreateSchema = z.object({
  actorUserId: objectIdSchema.nullish(),
  action: z.string().min(1).max(120),
  entityType: z.string().min(1).max(80),
  entityId: z.string().max(120).optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  ip: z.string().max(64).optional(),
});

export type AuditLogInput = z.infer<typeof auditLogCreateSchema>;
