/**
 * Whether an image `src` may go through the Next.js image optimizer.
 *
 * Everything on this site that shows a picture of something a *clinic* supplied
 * — a cover photo, a gallery shot, a logo, an editor's OG image — renders a URL
 * that came from the database, and the importer is free to record any host. When
 * that host is not in `config/images.mjs`, `next/image` still renders
 * `/_next/image?url=…`, our own origin answers **400**, and an auditor records a
 * broken *internal* image on the page.
 *
 * So call sites ask this first and pass `unoptimized` when it says no: the
 * component then emits the third-party URL untouched, which loads. Resizing and
 * WebP conversion are lost for that one image, which is the correct trade —
 * a smaller image nobody can see is worth less than a large one that renders.
 *
 * Pure and import-free apart from the host list, so it runs in both a Server and
 * a Client Component.
 */
import { IMAGE_REMOTE_HOSTS } from "@/config/images.mjs";

const ALLOWED = new Set<string>(IMAGE_REMOTE_HOSTS);

/**
 * `true` when `src` is same-origin (a root-relative path, a data/blob URI) or
 * points at an allow-listed remote host.
 *
 * Anything unparseable counts as *not* optimizable: a malformed URL that reaches
 * the optimizer produces the same 400 as an unlisted host, and rendering it
 * plainly at least lets the browser try.
 */
export function isOptimizableImageSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  // Root-relative and inline sources never reach the remote-host check.
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:"))
    return true;
  if (!/^https?:\/\//i.test(src)) return false;
  try {
    return ALLOWED.has(new URL(src).hostname.toLowerCase());
  } catch {
    return false;
  }
}
