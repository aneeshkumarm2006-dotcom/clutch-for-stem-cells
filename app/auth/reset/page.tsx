import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "We'll email you a secure reset link.",
};

export default function ResetPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const token = Array.isArray(searchParams.token)
    ? searchParams.token[0]
    : searchParams.token;

  return (
    <AuthCard
      title={token ? "Choose a new password" : "Reset your password"}
      subtitle={
        token
          ? "Set a new password for your account."
          : "We'll email you a secure reset link."
      }
      footer={
        <Link
          href="/auth/sign-in"
          className="font-semibold text-text-link hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <ResetForm token={token} />
    </AuthCard>
  );
}
