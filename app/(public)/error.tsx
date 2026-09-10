"use client";

/**
 * Public segment error boundary (Stage 9.7 / PRD §13). Catches render/data
 * errors in any public page and offers a retry, keeping the navbar/footer from
 * the layout intact. Logs only the error digest/message — never PII.
 *
 * Chunk failures are the exception: they get reloaded, not reported. A missing
 * chunk means this tab is holding HTML from a deployment that no longer exists,
 * so `reset()` would re-render against the same absent file and land right back
 * here. Reloading fetches the current document and the chunk names that go with
 * it. See `lib/chunk-error.ts` — it also explains why this boundary tripping is
 * an SEO problem: the page's JSON-LD is inside the subtree React unmounts.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { handlePossibleChunkError, isChunkLoadError } from "@/lib/chunk-error";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Start "recovering" for a chunk error so the crash screen never flashes
  // before the reload. Cleared if recovery turns out to be suppressed.
  const [recovering, setRecovering] = useState(() => isChunkLoadError(error));

  useEffect(() => {
    if (handlePossibleChunkError(error)) return;
    setRecovering(false);
    // eslint-disable-next-line no-console
    console.error("Public error boundary:", error.digest ?? error.message);
  }, [error]);

  if (recovering) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-[15px] text-text-secondary">Reloading the page…</p>
      </div>
    );
  }

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
