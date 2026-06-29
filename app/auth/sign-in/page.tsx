import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getCurrentUser, sanitizeCallbackUrl } from "@/lib/auth";
import { googleEnabled } from "@/lib/auth/options";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to manage your shortlist and reviews.",
};

/** Google-redirect error codes → friendly copy (Design §13). */
const ERROR_COPY: Record<string, string> = {
  AccountSuspended: "This account is suspended. Contact support for help.",
  OAuthAccountNotLinked:
    "That email is already registered. Sign in with your password instead.",
  AccessDenied: "Sign-in was cancelled or not permitted.",
  Configuration: "Sign-in is temporarily unavailable. Try again shortly.",
  Verification: "That link is invalid or has expired.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const callbackUrl = sanitizeCallbackUrl(searchParams.callbackUrl);

  const user = await getCurrentUser();
  if (user) redirect(callbackUrl);

  const errorCode = Array.isArray(searchParams.error)
    ? searchParams.error[0]
    : searchParams.error;
  const errorMessage = errorCode
    ? (ERROR_COPY[errorCode] ?? "Something went wrong. Try again.")
    : null;
  const verified = searchParams.verified === "1";
  const reset = searchParams.reset === "1";

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to manage your shortlist and reviews."
      footer={
        <>
          New here?{" "}
          <Link
            href="/auth/sign-up"
            className="font-semibold text-text-link hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      {verified ? (
        <Banner tone="success">Email verified — sign in to continue.</Banner>
      ) : null}
      {reset ? (
        <Banner tone="success">
          Password updated — sign in with your new password.
        </Banner>
      ) : null}
      {errorMessage ? <Banner tone="danger">{errorMessage}</Banner> : null}

      <SignInForm googleEnabled={googleEnabled} callbackUrl={callbackUrl} />
    </AuthCard>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "success" | "danger";
  children: React.ReactNode;
}) {
  const styles =
    tone === "success"
      ? "bg-success-bg text-success-fg"
      : "border border-danger/30 bg-danger-bg text-danger-fg";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`mb-4 flex items-center gap-2 rounded-md px-3.5 py-2.5 text-[13px] ${styles}`}
    >
      {tone === "success" ? <Check className="size-4 shrink-0" /> : null}
      {children}
    </div>
  );
}
