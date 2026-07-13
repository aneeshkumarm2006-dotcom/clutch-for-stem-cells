/**
 * Schema-aware blocks — the bridge from a Page's composition to JSON-LD.
 *
 * Blocks that carry structured meaning map to a schema.org node, so an editor
 * gets valid structured data *for free* just by composing the page: an `faq`
 * block emits `FAQPage`, a `comparisonTable` emits an `ItemList` of the compared
 * items. Blocks that are purely presentational (rich text, CTA, media…) map to
 * nothing and are simply skipped.
 *
 * Pure and React-free so the schema engine, the admin preview endpoint, and the
 * public renderer all share one source of truth.
 */
import { absoluteUrl, faqPageJsonLd, type JsonLd } from "@/lib/seo";
import type { BlockInput, ComparisonBlock, FaqBlock } from "@/lib/validation/block";

/**
 * `ItemList` of the rows in a comparison block. Distinct from `itemListJsonLd`
 * in `lib/seo.ts` (which lists linked clinics by path) because a comparison row
 * is a *named* item whose link is optional — we emit `url` only when present
 * rather than fabricating one.
 */
function comparisonItemListJsonLd(block: ComparisonBlock): JsonLd | null {
  const rows = block.rows.filter((r) => r.label.trim());
  if (!rows.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    ...(block.title ? { name: block.title } : {}),
    numberOfItems: rows.length,
    itemListElement: rows.map((row, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: row.label,
      ...(row.url ? { url: absoluteUrl(row.url) } : {}),
    })),
  };
}

/** `FAQPage` from an FAQ block — only when it has at least one complete pair. */
function faqBlockJsonLd(block: FaqBlock): JsonLd | null {
  const items = block.items.filter(
    (i) => i.question.trim() && i.answer.trim(),
  );
  if (!items.length) return null;
  return faqPageJsonLd(items);
}

/**
 * The JSON-LD node a single block contributes, or `null` when it contributes
 * none. Adding a schema-aware block type means adding one `case` here.
 */
export function blockToSchemaOrg(block: BlockInput): JsonLd | null {
  switch (block.type) {
    case "faq":
      return faqBlockJsonLd(block.data);
    case "comparisonTable":
      return comparisonItemListJsonLd(block.data);
    default:
      // Presentational blocks carry no structured meaning.
      return null;
  }
}

/**
 * Every node contributed by a page's blocks, in document order. Empty blocks
 * drop out, so a page with an unfilled FAQ block emits no `FAQPage` rather than
 * an empty one.
 */
export function blocksToSchemaOrg(blocks: BlockInput[]): JsonLd[] {
  return blocks
    .map(blockToSchemaOrg)
    .filter((node): node is JsonLd => node !== null);
}

/** `true` when a block type contributes structured data (drives editor hints). */
export function isSchemaAwareBlock(type: BlockInput["type"]): boolean {
  return type === "faq" || type === "comparisonTable";
}
