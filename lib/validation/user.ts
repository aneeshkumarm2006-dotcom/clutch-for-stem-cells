/**
 * User + auth validation (PRD §5.6 / Stage 1.10).
 *
 * Forms submit a plaintext `password`; the server hashes it into `passwordHash`
 * (Stage 2). Auth-flow schemas (sign-up/in, reset) live here so they share the
 * password policy.
 */
import { z } from "zod";
import { AUTH_PROVIDERS, USER_ROLES, USER_STATUSES } from "@/lib/enums";
import { imageSchema, objectIdSchema } from "@/lib/validation/common";

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128);

export const emailSchema = z
  .string()
  .email("Enter a valid email")
  .toLowerCase();

export const signUpSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  email: emailSchema,
  password: passwordSchema,
  /**
   * 18+ confirmation + terms acceptance (Compliance §8.6). A boolean (so the
   * checkbox can default to unchecked) refined to require opt-in; enforced
   * server-side in the register route, not just the form.
   */
  acceptedTerms: z.boolean().refine((v) => v === true, {
    message: "Confirm you're 18 or older and agree to the terms",
  }),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

/** Shared by password-reset request and verification resend (just an email). */
export const passwordResetRequestSchema = z.object({ email: emailSchema });
export const resendVerificationSchema = passwordResetRequestSchema;

export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const savedSearchSchema = z.object({
  label: z.string().max(120).optional(),
  query: z.string().min(1).max(2000),
});

/** Member-editable profile fields (`/account`). */
export const profileUpdateSchema = z
  .object({
    name: z.string().max(160),
    avatar: imageSchema,
  })
  .partial();

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

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type UserAdminInput = z.infer<typeof userAdminCreateSchema>;
