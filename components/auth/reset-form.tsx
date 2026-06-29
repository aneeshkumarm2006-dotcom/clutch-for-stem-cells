"use client";

/**
 * Password-reset form — Stage 2.5. Two modes:
 *  - no `token`  → request a reset link (always shows the generic "link sent"
 *    confirmation so registered emails can't be enumerated).
 *  - with `token` → set a new password, then redirect to sign-in.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import {
  passwordResetRequestSchema,
  passwordSchema,
  type PasswordResetRequestInput,
} from "@/lib/validation/user";

const setPasswordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Re-enter your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Those passwords don't match",
  });
type SetPasswordForm = z.infer<typeof setPasswordFormSchema>;

export function ResetForm({ token }: { token?: string }) {
  if (token) return <SetNewPassword token={token} />;
  return <RequestReset />;
}

function RequestReset() {
  const [sent, setSent] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: PasswordResetRequestInput) {
    await fetch("/api/auth/request-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSent(true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@email.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <Button
        type="submit"
        size="lg"
        className="mt-1 w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>

      {sent ? (
        <div className="mt-3.5 flex items-center gap-2 rounded-md bg-success-bg px-3.5 py-2.5 text-[12.5px] text-success-fg">
          <Check className="size-4 shrink-0" />
          If an account exists, a reset link is on its way.
        </div>
      ) : null}
    </form>
  );
}

function SetNewPassword({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SetPasswordForm) {
    setFormError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: values.password }),
    });
    if (res.ok) {
      router.push("/auth/sign-in?reset=1");
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    setFormError(
      data?.error ??
        "That reset link is invalid or has expired. Request a new one.",
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-[13px] text-danger-fg"
        >
          {formError}{" "}
          <Link
            href="/auth/reset"
            className="font-semibold underline underline-offset-2"
          >
            Start over
          </Link>
        </div>
      ) : null}
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={errors.password?.message}
        {...register("password")}
      />
      <Field
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button
        type="submit"
        size="lg"
        className="mt-1 w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
