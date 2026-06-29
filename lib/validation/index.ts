/**
 * Validation barrel — Stage 1.10.
 *
 * Shared Zod schemas mirroring each model, consumed by RHF forms and API/route
 * handlers: `import { clinicCreateSchema } from "@/lib/validation"`.
 */
export * from "@/lib/validation/common";
export * from "@/lib/validation/clinic";
export * from "@/lib/validation/review";
export * from "@/lib/validation/taxonomy";
export * from "@/lib/validation/lead";
export * from "@/lib/validation/article";
export * from "@/lib/validation/user";
export * from "@/lib/validation/plan";
export * from "@/lib/validation/site-setting";
export * from "@/lib/validation/audit-log";
export * from "@/lib/validation/media";
