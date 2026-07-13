/**
 * Server-side block helpers — sanitization and text extraction.
 *
 * Two jobs on every Page write:
 *  1. **Sanitize** the HTML inside HTML-bearing blocks. The editor's output is
 *     never trusted; `sanitizeBlogHtml` is the same allow-list the blog and
 *     combination-page bodies already pass through.
 *  2. **Expose the block text** to the YMYL cure/guarantee scanner. The scanner
 *     (`lib/content-review.ts`) reads flat `body`/`intro`/`faqs` fields, so a
 *     composed page has to project its blocks into that shape — otherwise a
 *     medical claim typed into a block would sail past the approval gate that
 *     the same claim in a MatrixPage body would be caught by.
 */
import "server-only";

import { sanitizeBlogHtml } from "@/lib/seoteam/sanitize";
import type { BlockInput } from "@/lib/validation/block";

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

/** Strip tags so the scanner sees prose, not markup. */
const stripTags = (html: string): string =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/**
 * All human-readable text in a page's blocks, flattened. Fed to the review gate
 * as the page's `body` so claims in *any* block are scanned.
 */
export function blocksScanText(blocks: BlockInput[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "richText":
      case "rawHtml":
        parts.push(stripTags(block.data.html));
        break;
      case "faq":
        if (block.data.title) parts.push(block.data.title);
        for (const i of block.data.items) parts.push(i.question, i.answer);
        break;
      case "comparisonTable":
        if (block.data.title) parts.push(block.data.title);
        for (const r of block.data.rows) parts.push(r.label, ...r.cells);
        break;
      case "featureGrid":
        if (block.data.title) parts.push(block.data.title);
        for (const i of block.data.items) {
          parts.push(i.title, i.description ?? "");
        }
        break;
      case "prosCons":
        if (block.data.title) parts.push(block.data.title);
        parts.push(...block.data.pros, ...block.data.cons);
        break;
      case "cta":
        parts.push(block.data.title, block.data.body ?? "");
        break;
      case "media":
        parts.push(block.data.caption ?? "");
        break;
    }
  }

  return parts.filter(Boolean).join("\n");
}

/** Q&A pairs from every FAQ block — the scanner reads `faqs` separately. */
export function blocksFaqs(
  blocks: BlockInput[],
): { question: string; answer: string }[] {
  return blocks
    .filter((b): b is Extract<BlockInput, { type: "faq" }> => b.type === "faq")
    .flatMap((b) => b.data.items)
    .filter((i) => i.question.trim() && i.answer.trim());
}
