/**
 * Deploy-skew ("chunk load") error detection and recovery.
 *
 * The failure this handles is not a bug in any page. Next.js splits the client
 * bundle into content-hashed chunks and names them inside the HTML/RSC payload
 * a visitor already holds. Ship a new deployment and those filenames change, so
 * a tab that was opened before the deploy (or a bfcache/prefetch entry, or a
 * CDN-cached document) asks for a chunk that no longer exists. The import
 * rejects, React unwinds to the nearest `error.tsx`, and the visitor gets
 * "Something went wrong" on a page that is perfectly healthy on reload.
 *
 * It matters for SEO beyond the visible crash: every page-level
 * `<script type="application/ld+json">` lives *inside* that boundary, so when it
 * trips, React unmounts the page subtree and takes the page's structured data
 * with it. The layout's `Organization`/`WebSite` nodes survive (they are above
 * the boundary), which is why a crashed clinic page reports as having nothing
 * but generic `Organization` markup in Google's Rich Results Test.
 *
 * The platform-side half of the fix is keeping the old chunks reachable
 * (Vercel Skew Protection + `deploymentId` — see `next.config.mjs`). This module
 * is the half that works regardless of hosting: recognise the error and reload
 * once, which fetches the current HTML and the chunk names that go with it.
 *
 * Dependency-free and safe to import from a client component or an error
 * boundary. Every entry point tolerates being called during SSR.
 */

/** sessionStorage key holding the timestamp of the last automatic recovery. */
const RECOVERY_KEY = "mscg:chunk-recovery";

/**
 * How long a recovery attempt suppresses the next one. A stale document is
 * fixed by one reload, so a second failure inside this window means reloading
 * is not the cure (a genuinely missing chunk, an offline client, a broken
 * deploy) and we must stop rather than spin the tab.
 */
const RECOVERY_COOLDOWN_MS = 30_000;

/**
 * Message/name fragments that identify a failed script or stylesheet chunk.
 * Collected across bundlers and engines because there is no single error type:
 * webpack throws `ChunkLoadError`, native ESM rejects with a browser-specific
 * message, and Safari and Firefox each word theirs differently.
 */
const CHUNK_ERROR_PATTERNS = [
  "chunkloaderror",
  "loading chunk",
  "loading css chunk",
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "module script failed to load",
  "expected a javascript module script",
  "'text/html' is not a valid javascript mime type",
];

/** `true` when the error is a missing/failed chunk rather than app logic. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  // webpack tags its own with a name, which is the unambiguous signal.
  const name = (error as { name?: unknown }).name;
  if (typeof name === "string" && name === "ChunkLoadError") return true;

  const message = (error as { message?: unknown }).message;
  const haystack = (
    typeof message === "string" ? message : String(error)
  ).toLowerCase();
  if (CHUNK_ERROR_PATTERNS.some((p) => haystack.includes(p))) return true;

  // Last resort: an import failure that named a build asset. Checked on the
  // message only (never a stack) so an unrelated error that merely *passed
  // through* bundled code is not mistaken for a missing chunk.
  return (
    haystack.includes("/_next/static/") &&
    (haystack.includes("failed") || haystack.includes("error"))
  );
}

/**
 * `true` when an automatic reload is still allowed. Reads sessionStorage, so it
 * resets per tab and cannot lock a visitor out across sessions. Storage access
 * throws in some privacy modes; a failure to read is treated as "allowed",
 * because a crashed page with no recovery is the worse outcome.
 */
function canRecover(): boolean {
  try {
    const last = window.sessionStorage.getItem(RECOVERY_KEY);
    if (!last) return true;
    const elapsed = Date.now() - Number(last);
    return !Number.isFinite(elapsed) || elapsed > RECOVERY_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markRecovery(): void {
  try {
    window.sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
  } catch {
    // Private mode / storage disabled. The reload below still happens; only the
    // loop guard is lost, and the cooldown is re-armed on the next page load.
  }
}

/**
 * Reload the current URL once to pick up the current deployment's chunk names.
 *
 * Returns `true` if a reload was started, `false` if it was suppressed (already
 * recovered recently, or not running in a browser). Callers use the return value
 * to decide whether to render a fallback UI: `true` means the page is about to
 * be replaced, so there is no point painting an error screen.
 */
export function recoverFromChunkError(): boolean {
  if (typeof window === "undefined") return false;
  if (!canRecover()) return false;
  markRecovery();
  // `location.reload()` revalidates the document (public pages ship
  // `max-age=0, must-revalidate`), so the fresh HTML names chunks that exist.
  window.location.reload();
  return true;
}

/**
 * Detect *and* recover in one call, for error boundaries.
 * `false` means "not a chunk error, or recovery is suppressed — show your UI".
 */
export function handlePossibleChunkError(error: unknown): boolean {
  return isChunkLoadError(error) && recoverFromChunkError();
}
