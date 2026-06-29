/**
 * Plan validation (PRD §5.7 / Stage 1.10) — listing tier config (`/admin/plans`).
 */
import { z } from "zod";
import { PLAN_KEYS } from "@/lib/enums";
import { currencySchema } from "@/lib/validation/common";

export const planCreateSchema = z.object({
  key: z.enum(PLAN_KEYS),
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(500).optional(),
  priceMonthly: z.number().min(0).optional(),
  priceYearly: z.number().min(0).optional(),
  currency: currencySchema,
  features: z.array(z.string().max(200)).default([]),
  badge: z.string().max(60).optional(),
  highlighted: z.boolean().default(false),
  isActive: z.boolean().default(true),
  ctaLabel: z.string().max(60).optional(),
  order: z.number().int().default(0),
});

export const planUpdateSchema = planCreateSchema.partial();

export type PlanInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
