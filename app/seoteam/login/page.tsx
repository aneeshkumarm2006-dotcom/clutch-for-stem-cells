import * as React from "react";
import type { Metadata } from "next";

import { SITE_NAME } from "@/config/site";
import { LoginForm } from "@/components/seoteam/login-form";

export const metadata: Metadata = {
  title: "Sign in · SEO Team",
  robots: { index: false, follow: false },
};

export default function SeoTeamLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
            {SITE_NAME.charAt(0)}
          </div>
          <h1 className="font-display text-xl font-bold tracking-[-0.01em] text-text-primary">
            SEO Studio
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in to publish and manage blog posts.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <React.Suspense fallback={null}>
            <LoginForm />
          </React.Suspense>
        </div>
        <p className="mt-4 text-center text-[12.5px] text-text-muted">
          Authorized team members only.
        </p>
      </div>
    </div>
  );
}
