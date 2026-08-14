/**
 * JSON-LD for a term page's approved editorial content.
 *
 * Every taxonomy detail page (treatment, condition, country, city) renders the
 * same `EditorialArticle`, so they should emit the same structured data for it.
 * Without a shared helper the four pages drift: one grows an `ItemList` from its
 * comparison blocks, another quietly emits two competing `FAQPage` nodes.
 *
 * The one rule worth stating: FAQ pairs from the term's own `faqs` field and
 * from any FAQ blocks are merged into a SINGLE `FAQPage`. Two `FAQPage` nodes on
 * one URL is the classic way to lose the rich result entirely.
 */
import { blocksToSchemaOrg } from "@/lib/blocks/schema";
import { blocksFaqs } from "@/lib/blocks/content";
import { faqPageJsonLd, type JsonLd } from "@/lib/seo";
import type { BlockInput } from "@/lib/validation/block";

/** One Q&A pair. Structural so any editorial view model satisfies it. */
export interface FaqEntry {
  question: string;
  answer: string;
}

export interface EditorialSchemaInput {
  faqs: FaqEntry[];
  blocks?: BlockInput[];
}

/** Every Q&A pair on the page — the term's own plus its FAQ blocks', deduped. */
export function editorialFaqs(
  editorial: EditorialSchemaInput | null | undefined,
): FaqEntry[] {
  if (!editorial) return [];
  const seen = new Set<string>();
  return [...editorial.faqs, ...blocksFaqs(editorial.blocks ?? [])].filter(
    (f) => {
      const key = f.question.trim().toLowerCase();
      if (!key || !f.answer.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  );
}

/**
 * The nodes a term page's editorial contributes: one merged `FAQPage`, plus
 * whatever its non-FAQ blocks emit (a comparison table's `ItemList`, a step
 * sequence's ordered `ItemList`, …).
 */
export function editorialJsonLd(
  editorial: EditorialSchemaInput | null | undefined,
  /** Root-relative path of the page, so the `FAQPage` gets a scoped `@id`. */
  path?: string,
): JsonLd[] {
  if (!editorial) return [];
  const faqs = editorialFaqs(editorial);
  return [
    ...(faqs.length ? [faqPageJsonLd(faqs, path)] : []),
    ...blocksToSchemaOrg(editorial.blocks ?? [], { skip: ["faq"] }),
  ];
}
