"use client";

/**
 * Admin segment error boundary (Stage 9.7 / PRD §13). Keeps the admin shell
 * usable when a module throws and offers a retry. Logs only digest/message.
 */
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Admin error boundary:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-display text-xl font-semibold text-text-primary">
        This module hit an error
      </h1>
      <p className="mt-2 max-w-md text-sm text-text-secondary">
        Something went wrong loading this admin view. Try again — if it persists,
        check the server logs.
      </p>
      <Button className="mt-5" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
