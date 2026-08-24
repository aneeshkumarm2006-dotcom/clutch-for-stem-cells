/**
 * User + auth validation (PRD §5.6 / Stage 1.10).
 *
 * Forms submit a plaintext `password`; the server hashes it into `passwordHash`
 * (Stage 2). Auth-flow schemas (sign-in, reset) live here so they share the
 * password policy with admin user creation.
 *
 * There is no sign-up schema: public registration was removed, and accounts are
 * created by a Super Admin via `userAdminCreateSchema`.
 */
import { z } from "zod";
import { AUTH_PROVIDERS, USER_ROLES, USER_STATUSES } from "@/lib/enums";
import { objectIdSchema } from "@/lib/validation/common";

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128);

export const emailSchema = z
  .string()
  .email("Enter a valid email")
  .toLowerCase();

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

/** Password-reset request (just an email). */
export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const savedSearchSchema = z.object({
  label: z.string().max(120).optional(),
  query: z.string().min(1).max(2000),
});

/** Admin user create/edit (`/admin/users`, §8.8). */
export const userAdminCreateSchema = z.object({
  name: z.string().max(160).optional(),
  email: emailSchema,
  role: z.enum(USER_ROLES).default("member"),
  status: z.enum(USER_STATUSES).default("active"),
  provider: z.enum(AUTH_PROVIDERS).default("credentials"),
  password: passwordSchema.optional(),
  ownerClinicId: objectIdSchema.optional(),
});

export const userUpdateSchema = userAdminCreateSchema.partial();

export type SignInInput = z.infer<typeof signInSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type UserAdminInput = z.infer<typeof userAdminCreateSchema>;
