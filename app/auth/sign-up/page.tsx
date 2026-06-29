import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getCurrentUser, sanitizeCallbackUrl } from "@/lib/auth";
import { googleEnabled } from "@/lib/auth/options";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Save clinics and track your reviews.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const callbackUrl = sanitizeCallbackUrl(searchParams.callbackUrl);

  const user = await getCurrentUser();
  if (user) redirect(callbackUrl);

  return (
    <AuthCard
      title="Create your account"
      subtitle="Save clinics and track your reviews."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/auth/sign-in"
            className="font-semibold text-text-link hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm googleEnabled={googleEnabled} callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
