/**
 * Pure block helpers — parsing and text extraction, shared by client and server.
 *
 * Deliberately free of `server-only`, React, and mongoose so exactly one
 * implementation serves all four consumers: the public renderer, the admin
 * read layer, the YMYL review gate, and the live cure/guarantee warning in the
 * editor (which runs in the browser). A second copy of the extraction rules is
 * how a claim typed into a block starts rendering in one place and getting
 * scanned in another.
 */
import { blockSchema, type BlockInput } from "@/lib/validation/block";

/**
 * Parse raw stored blocks into validated ones, dropping any that no longer match
 * their schema. A legacy or hand-edited row is skipped rather than crashing the
 * page it appears on.
 */
export function parseBlocks(raw: unknown): BlockInput[] {
  if (!Array.isArray(raw)) return [];
  const out: BlockInput[] = [];
  for (const item of raw) {
    const parsed = blockSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Strip tags so the scanner sees prose, not markup. */
const stripTags = (html: string): string =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/**
 * All human-readable text in a composition, flattened. Fed to the review gate so
 * claims in *any* block are scanned, and to the editor's live warning so the
 * author sees the same flags before saving.
 *
 * Exhaustive over the block union via the `never` check at the end: a new block
 * type without a case here is a compile error, not text that silently escapes
 * the compliance scanner.
 */
export function blocksScanText(blocks: BlockInput[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "richText":
      case "rawHtml":
        parts.push(stripTags(block.data.html));
        break;
      case "keyTakeaways":
        if (block.data.title) parts.push(block.data.title);
        parts.push(...block.data.items);
        break;
      case "steps":
        parts.push(block.data.title ?? "", block.data.intro ?? "");
        for (const s of block.data.steps) {
          parts.push(s.title, s.description ?? "");
        }
        parts.push(block.data.footnote ?? "");
        break;
      case "checklist":
        parts.push(block.data.title ?? "", block.data.intro ?? "");
        parts.push(...block.data.items);
        parts.push(block.data.footnote ?? "");
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
      case "statGrid":
        if (block.data.title) parts.push(block.data.title);
        for (const s of block.data.stats) parts.push(s.value, s.label);
        break;
      case "callout":
        parts.push(block.data.title ?? "", block.data.body);
        break;
      case "quote":
        parts.push(
          block.data.quote,
          block.data.attribution ?? "",
          block.data.role ?? "",
        );
        break;
      case "linkList":
        if (block.data.title) parts.push(block.data.title);
        for (const l of block.data.links) {
          parts.push(l.label, l.description ?? "");
        }
        break;
      case "cta":
        parts.push(block.data.title, block.data.body ?? "");
        break;
      case "media":
        parts.push(block.data.caption ?? "");
        break;
      default: {
        const exhaustive: never = block;
        void exhaustive;
      }
    }
  }

  return parts.filter((p) => p.trim()).join("\n");
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
