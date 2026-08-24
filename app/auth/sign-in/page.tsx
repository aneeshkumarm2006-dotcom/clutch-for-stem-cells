import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getCurrentUser, sanitizeCallbackUrl } from "@/lib/auth";

/**
 * Staff sign-in. Public sign-up and Google OAuth were removed, so this page is
 * only reachable by someone who already has an account (admin/editor) — hence
 * `noindex` and no "create an account" footer.
 */
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the site admin.",
  robots: { index: false, follow: false },
};

/** Error codes NextAuth can redirect here with → friendly copy (Design §13). */
const ERROR_COPY: Record<string, string> = {
  AccountSuspended: "This account is suspended. Contact support for help.",
  TooManyAttempts: "Too many attempts. Wait a few minutes and try again.",
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
  const reset = searchParams.reset === "1";

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to the site admin.">
      {reset ? (
        <Banner tone="success">
          Password updated. Sign in with your new password.
        </Banner>
      ) : null}
      {errorMessage ? <Banner tone="danger">{errorMessage}</Banner> : null}

      <SignInForm callbackUrl={callbackUrl} />
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
