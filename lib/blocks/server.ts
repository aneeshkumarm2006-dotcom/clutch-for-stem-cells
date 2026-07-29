/**
 * Server-side block helpers — sanitization.
 *
 * The editor's HTML output is never trusted: `sanitizeBlogHtml` (the same
 * allow-list the blog and combination-page bodies pass through) runs on every
 * write, so the string in the DB is already safe by render time.
 *
 * The *other* job on a write — exposing block text to the YMYL cure/guarantee
 * scanner — lives in `lib/blocks/content.ts` because the editor runs the same
 * extraction in the browser for its live warning. Re-exported here so server
 * callers keep a single import.
 */
import "server-only";

import { sanitizeBlogHtml } from "@/lib/seoteam/sanitize";
import type { BlockInput } from "@/lib/validation/block";

export { blocksFaqs, blocksScanText, parseBlocks } from "@/lib/blocks/content";

/** Sanitize every HTML-bearing block. Other block types pass through. */
export function sanitizeBlocks(blocks: BlockInput[]): BlockInput[] {
  return blocks.map((block) => {
    switch (block.type) {
      case "richText":
      case "rawHtml":
        return {
          ...block,
          data: { ...block.data, html: sanitizeBlogHtml(block.data.html) },
        };
      default:
        return block;
    }
  });
}
