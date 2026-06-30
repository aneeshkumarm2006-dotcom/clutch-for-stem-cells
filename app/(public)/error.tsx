"use client";

/**
 * Public segment error boundary (Stage 9.7 / PRD §13). Catches render/data
 * errors in any public page and offers a retry, keeping the navbar/footer from
 * the layout intact. Logs only the error digest/message — never PII.
 */
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Public error boundary:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-display text-2xl font-bold text-text-primary">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-[15px] text-text-secondary">
        We hit an unexpected error loading this page. You can try again or head
        back home.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="secondary">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
