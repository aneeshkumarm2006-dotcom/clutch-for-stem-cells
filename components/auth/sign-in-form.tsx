"use client";

/**
 * Sign-in form — Stage 2.5. Credentials via `signIn("credentials")` plus the
 * Google button. Maps the typed auth-error codes from `authOptions` to friendly
 * copy (Design §13 voice) and, when the email isn't verified yet, offers an
 * inline "resend verification" action.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { signInSchema, type SignInInput } from "@/lib/validation/user";

const ERROR_COPY: Record<string, string> = {
  InvalidCredentials: "That email or password doesn't match. Try again.",
  AccountSuspended: "This account is suspended. Contact support for help.",
  EmailNotVerified: "Verify your email to sign in — check your inbox.",
};

export function SignInForm({
  googleEnabled,
  callbackUrl,
}: {
  googleEnabled: boolean;
  callbackUrl: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [unverified, setUnverified] = React.useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInInput) {
    setFormError(null);
    setUnverified(false);

    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl,
    });

    if (res?.error) {
      const code = res.error in ERROR_COPY ? res.error : "InvalidCredentials";
      setFormError(ERROR_COPY[code]);
      if (code === "EmailNotVerified") setUnverified(true);
      return;
    }
    router.push(res?.url ?? callbackUrl);
    router.refresh();
  }

  async function resendVerification() {
    const email = getValues("email");
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    toast.success("If that account needs verifying, a new link is on its way.");
  }

  return (
    <div>
      {googleEnabled ? (
        <>
          <GoogleButton callbackUrl={callbackUrl} />
          <OrDivider />
        </>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-[13px] text-danger-fg"
        >
          {formError}
          {unverified ? (
            <button
              type="button"
              onClick={resendVerification}
              className="ml-1 font-semibold underline underline-offset-2"
            >
              Resend it
            </button>
          ) : null}
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
