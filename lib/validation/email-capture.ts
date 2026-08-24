/**
 * Guide-capture validation.
 *
 * `emailCaptureCreateSchema` is the public modal submission: one email plus the
 * context the browser already knows (which trigger fired, what was in the
 * shortlist, where they were). Every context field is optional and capped, so a
 * crafted body can widen the record but never turn the endpoint into free
 * storage. `emailCaptureUpdateSchema` covers admin triage.
 */
import { z } from "zod";

import { CAPTURE_STATUSES, CAPTURE_TRIGGERS } from "@/lib/enums";
import { slugSchema } from "@/lib/validation/common";

/** Trimmed, length-capped free text that collapses blanks to `undefined`. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailCaptureCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .max(254)
    .email("Enter a valid email address")
    .transform((v) => v.toLowerCase()),
  trigger: z.enum(CAPTURE_TRIGGERS),
  // The shortlist is a client-held list of slugs; anything that isn't a slug is
  // dropped rather than rejected, so one stale entry can't lose the capture.
  shortlistSlugs: z
    .array(z.unknown())
    .max(200)
    .optional()
    .transform((arr) =>
      (arr ?? [])
        .filter((s): s is string => typeof s === "string")
        .filter((s) => slugSchema.safeParse(s).success)
        .slice(0, 50),
    ),
  profileViewCount: z.number().int().min(0).max(10_000).optional(),
  path: text(300),
  referrer: text(500),
  utm: z
    .object({
      source: text(120),
      medium: text(120),
      campaign: text(200),
      term: text(200),
      content: text(200),
    })
    .partial()
    .optional(),
});

export const emailCaptureUpdateSchema = z.object({
  status: z.enum(CAPTURE_STATUSES).optional(),
  internalNote: z.string().trim().max(2000).optional(),
});

export type EmailCaptureCreateInput = z.infer<typeof emailCaptureCreateSchema>;
export type EmailCaptureUpdateInput = z.infer<typeof emailCaptureUpdateSchema>;
