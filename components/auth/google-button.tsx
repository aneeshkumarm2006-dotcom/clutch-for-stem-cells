"use client";

/**
 * "Continue with Google" — Stage 2.5. Only rendered when Google OAuth is
 * configured (the page passes `googleEnabled` from `lib/auth/options`).
 */
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { GoogleMark } from "@/components/brand/platform-marks";

export function GoogleButton({
  callbackUrl,
  label = "Continue with Google",
}: {
  callbackUrl: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      onClick={() => signIn("google", { callbackUrl })}
    >
      <GoogleMark className="size-[17px]" />
      {label}
    </Button>
  );
}

/** Horizontal "or" divider used between the Google button and the email form. */
export function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-100" />
      <span className="text-xs text-text-muted">or</span>
      <span className="h-px flex-1 bg-slate-100" />
    </div>
  );
}
