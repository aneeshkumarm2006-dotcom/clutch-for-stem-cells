"use client";

/**
 * Site-wide recovery for deploy-skew chunk failures. Mounted once in the root
 * layout so it covers the public site, /admin and /seoteam alike.
 *
 * Two of the three paths a missing chunk can take are invisible to React's error
 * boundaries, so a boundary alone is not enough:
 *
 *  1. The `<script>`/`<link>` tag for a chunk 404s. The browser fires a
 *     *resource* error event that never becomes a JS exception. Nothing crashes
 *     yet, but the code in that chunk is gone, so whatever it powered is inert.
 *     This is the earliest and cleanest signal, and the one behind the quiet
 *     "failed resources" symptom.
 *  2. A lazy `import()` rejects outside of render — a click handler, an effect,
 *     a router prefetch. It surfaces as an unhandled rejection, not as a render
 *     error, so no `error.tsx` ever sees it.
 *  3. A lazy import rejects *during* render. This one does reach `error.tsx`,
 *     which handles it directly (see `app/(public)/error.tsx`).
 *
 * All three end in the same one-shot reload, rate-limited per tab by
 * `lib/chunk-error.ts` so a genuinely broken build cannot put a visitor in a
 * refresh loop.
 *
 * Renders nothing.
 */
import { useEffect } from "react";

import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-error";

/** `true` for a failed script/stylesheet request under `/_next/static/`. */
function isBuildAssetElement(target: EventTarget | null): boolean {
  if (!(
    target instanceof HTMLScriptElement || target instanceof HTMLLinkElement
  )) {
    return false;
  }
  // Fonts and images under the same prefix are excluded by the element check
  // above: a missing font degrades to a fallback face and must not reload.
  const src = target instanceof HTMLScriptElement ? target.src : target.href;
  return typeof src === "string" && src.includes("/_next/static/");
}

export function ChunkErrorRecovery() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      // A resource error has no `error` payload — the failing tag is the target.
      if (!event.error && isBuildAssetElement(event.target)) {
        recoverFromChunkError();
        return;
      }
      if (isChunkLoadError(event.error)) recoverFromChunkError();
    }

    function onRejection(event: PromiseRejectionEvent) {
      if (isChunkLoadError(event.reason)) recoverFromChunkError();
    }

    // Resource errors do not bubble, so the listener has to be in the capture
    // phase to see them at all.
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
