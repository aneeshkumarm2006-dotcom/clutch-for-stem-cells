"use client";

/**
 * "Continue with Google" — Stage 2.5. Only rendered when Google OAuth is
 * configured (the page passes `googleEnabled` from `lib/auth/options`).
 */
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.9Z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .6-2.2 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.3v2.8A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M6 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.3a11 11 0 0 0 0 9.8L6 14.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3 .5 4.1 1.6l3-3A11 11 0 0 0 2.3 7.1L6 9.9c.8-2.6 3.2-4.5 6-4.5Z"
      />
    </svg>
  );
}

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
      <GoogleIcon />
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
