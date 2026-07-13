/**
 * Redirect validation. `from` must be a root-relative path (you can only
 * redirect a URL on this site); `to` may be a path or an absolute URL.
 */
import { z } from "zod";

import { REDIRECT_STATUS_CODES } from "@/lib/enums";

/** A root-relative path: leading slash, no protocol, no trailing slash. */
const fromPathSchema = z
  .string()
  .min(1, "Source path is required")
  .max(500)
  .refine((v) => v.startsWith("/"), "Source must start with /")
  .refine(
    (v) => !/^https?:\/\//i.test(v),
    "Source must be a path on this site, not a full URL",
  )
  .transform((v) => normalizePath(v));

const toTargetSchema = z
  .string()
  .min(1, "Destination is required")
  .max(1000)
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\//i.test(v),
    "Destination must be a path or an absolute URL",
  );

/** Lowercase, strip the query/hash and any trailing slash. `/` stays `/`. */
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0]!.trim().toLowerCase();
  if (clean.length > 1 && clean.endsWith("/")) return clean.replace(/\/+$/, "");
  return clean || "/";
}

export const redirectCreateSchema = z
  .object({
    from: fromPathSchema,
    to: toTargetSchema,
    statusCode: z
      .union([z.literal(301), z.literal(302)])
      .default(301),
  })
  .refine((v) => v.from !== v.to, {
    message: "A redirect cannot point at itself",
    path: ["to"],
  });

export const redirectUpdateSchema = z.object({
  to: toTargetSchema.optional(),
  statusCode: z.union([z.literal(301), z.literal(302)]).optional(),
});

export type RedirectInput = z.infer<typeof redirectCreateSchema>;

/** Re-exported so the model and admin UI share one list. */
export { REDIRECT_STATUS_CODES };
