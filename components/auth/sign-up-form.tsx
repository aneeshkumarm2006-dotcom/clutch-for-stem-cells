"use client";

/**
 * Sign-up form — Stage 2.5. POSTs to `/api/auth/register`, then swaps to a
 * "check your email" state (the account stays unverified until the link is
 * clicked). Includes the 18+/terms checkbox required by Compliance §8.6.
 */
import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { signUpSchema, type SignUpInput } from "@/lib/validation/user";

export function SignUpForm({
  googleEnabled,
  callbackUrl,
}: {
  googleEnabled: boolean;
  callbackUrl: string;
}) {
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", acceptedTerms: false },
  });

  async function onSubmit(values: SignUpInput) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (res.status === 201) {
      setSentTo(values.email);
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (res.status === 409) {
      setError("email", {
        message: data?.error ?? "That email's already in use. Try signing in.",
      });
      return;
    }
    toast.error(data?.error ?? "Something went wrong. Try again.");
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-success-bg text-success">
          <MailCheck className="size-5" />
        </span>
        <h2 className="font-display text-lg font-bold text-text-primary">
          Check your email
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          We sent a verification link to <strong>{sentTo}</strong>. Open it to
          finish setting up your account.
        </p>
        <Button asChild variant="secondary" className="mt-5 w-full">
          <Link href="/auth/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      {googleEnabled ? (
        <>
          <GoogleButton callbackUrl={callbackUrl} label="Sign up with Google" />
          <OrDivider />
        </>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="Full name"
          autoComplete="name"
          placeholder="Your name"
          error={errors.name?.message}
          {...register("name")}
        />
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />

        <label className="mb-4 mt-1 flex items-start gap-2.5 text-[12.5px] text-text-secondary">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded border-border-strong text-primary accent-primary focus-visible:outline-none"
            {...register("acceptedTerms")}
          />
          <span>
            I&apos;m 18 or older and agree to the{" "}
            <Link
              href="/terms"
              className="font-medium text-text-link hover:underline"
            >
              terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-medium text-text-link hover:underline"
            >
              privacy policy
            </Link>
            .
          </span>
        </label>
        {errors.acceptedTerms ? (
          <p className="-mt-2 mb-3 text-[12.5px] text-danger">
            {errors.acceptedTerms.message}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
