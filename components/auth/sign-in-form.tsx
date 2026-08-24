"use client";

/**
 * Staff sign-in form — Stage 2.5. Credentials only; the Google button and the
 * "resend verification" action went with public sign-up (accounts are created
 * pre-verified in `/admin/users`, so an unverified account can't reach here).
 * Maps the typed auth-error codes from `authOptions` to friendly copy.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import { signInSchema, type SignInInput } from "@/lib/validation/user";

const ERROR_COPY: Record<string, string> = {
  InvalidCredentials: "That email or password doesn't match. Try again.",
  AccountSuspended: "This account is suspended. Contact support for help.",
  EmailNotVerified: "This account isn't verified yet. Ask a Super Admin.",
  TooManyAttempts: "Too many attempts. Wait a few minutes and try again.",
};

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInInput) {
    setFormError(null);

    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl,
    });

    if (res?.error) {
      const code = res.error in ERROR_COPY ? res.error : "InvalidCredentials";
      setFormError(ERROR_COPY[code]!);
      return;
    }
    router.push(res?.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <div>
      {formError ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-[13px] text-danger-fg"
        >
          {formError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@email.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password?.message}
          labelAccessory={
            <Link
              href="/auth/reset"
              className="text-[12.5px] font-semibold text-text-link hover:underline"
            >
              Forgot?
            </Link>
          }
          {...register("password")}
        />
        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
