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
import type {
  BlockInput,
  ComparisonBlock,
  FaqBlock,
  StepsBlock,
} from "@/lib/validation/block";

/**
 * One entry of an `ItemList` whose members are named things rather than links.
 *
 * A `ListItem` has to identify what it lists — either a `url` pointing at the
 * item's own page (the "summary page" form `itemListJsonLd` in `lib/seo.ts`
 * uses for clinics) or a nested `item` describing it inline (the "all-in-one
 * page" form). A comparison row or a process step has no page of its own, so
 * `name` alone leaves the entry identifying nothing and validators reject the
 * whole list. `item` carries the description too, which the flat form has
 * nowhere to put.
 */
function namedListItem(
  position: number,
  name: string,
  extra?: { description?: string; url?: string },
): JsonLd {
  const url = extra?.url ? absoluteUrl(extra.url) : undefined;
  return {
    "@type": "ListItem",
    position,
    name,
    ...(url ? { url } : {}),
    item: {
      "@type": "Thing",
      name,
      ...(extra?.description ? { description: extra.description } : {}),
      ...(url ? { url } : {}),
    },
  };
}

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
    itemListElement: rows.map((row, i) =>
      namedListItem(i + 1, row.label, { url: row.url }),
    ),
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
 * `ItemList` of an ordered process. Deliberately NOT `HowTo`: Google retired
 * HowTo rich results, and a medical procedure described for orientation is not
 * a set of instructions a reader should follow. An ordered `ItemList` states the
 * sequence without implying it is a protocol to carry out.
 */
function stepsItemListJsonLd(block: StepsBlock): JsonLd | null {
  const steps = block.steps.filter((s) => s.title.trim());
  if (!steps.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    ...(block.title ? { name: block.title } : {}),
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: steps.length,
    itemListElement: steps.map((step, i) =>
      namedListItem(i + 1, step.title, { description: step.description }),
    ),
  };
}

/**
 * The JSON-LD node a single block contributes, or `null` when it contributes
 * none. Adding a schema-aware block type means adding one `case` here and one
 * entry to `SCHEMA_AWARE_BLOCKS`.
 */
export function blockToSchemaOrg(block: BlockInput): JsonLd | null {
  switch (block.type) {
    case "faq":
      return faqBlockJsonLd(block.data);
    case "comparisonTable":
      return comparisonItemListJsonLd(block.data);
    case "steps":
      return stepsItemListJsonLd(block.data);
    default:
      // Presentational blocks carry no structured meaning.
      return null;
  }
}

/**
 * Every node contributed by a composition, in document order. Empty blocks drop
 * out, so an unfilled FAQ block emits no `FAQPage` rather than an empty one.
 *
 * `skip` exists for pages that already own a node of the same kind: a taxonomy
 * term page merges its own `faqs` with the ones in its FAQ blocks into a single
 * `FAQPage`, rather than emitting two competing ones.
 */
export function blocksToSchemaOrg(
  blocks: BlockInput[],
  opts?: { skip?: readonly BlockInput["type"][] },
): JsonLd[] {
  const skip = opts?.skip;
  return blocks
    .filter((b) => !skip?.includes(b.type))
    .map(blockToSchemaOrg)
    .filter((node): node is JsonLd => node !== null);
}

/** Block types that contribute structured data just by being used. */
const SCHEMA_AWARE_BLOCKS: readonly BlockInput["type"][] = [
  "faq",
  "comparisonTable",
  "steps",
];

/** `true` when a block type contributes structured data (drives editor hints). */
export function isSchemaAwareBlock(type: BlockInput["type"]): boolean {
  return SCHEMA_AWARE_BLOCKS.includes(type);
}
