/**
 * Block renderer — turns a Page's stored `blocks` array into the page body.
 *
 * The switch is exhaustive over the block union, so adding a block type to
 * `lib/validation/block.ts` without adding a renderer here is a *compile error*,
 * not a blank space on a live page.
 *
 * Blocks arriving from the DB are re-parsed through the block schema before
 * rendering. A legacy or hand-edited row whose `data` no longer matches its
 * type is skipped rather than crashing the page.
 */
import * as React from "react";

import { blockSchema, type BlockInput } from "@/lib/validation/block";
import {
  ComparisonRenderer,
  CtaRenderer,
  FaqRenderer,
  FeatureGridRenderer,
  MediaRenderer,
  ProsConsRenderer,
  RawHtmlRenderer,
  RichTextRenderer,
} from "@/components/blocks/renderers";

/** Render one validated block. Exhaustive over the union. */
function renderBlock(block: BlockInput): React.ReactNode {
  switch (block.type) {
    case "richText":
      return <RichTextRenderer data={block.data} />;
    case "faq":
      return <FaqRenderer data={block.data} />;
    case "comparisonTable":
      return <ComparisonRenderer data={block.data} />;
    case "featureGrid":
      return <FeatureGridRenderer data={block.data} />;
    case "prosCons":
      return <ProsConsRenderer data={block.data} />;
    case "cta":
      return <CtaRenderer data={block.data} />;
    case "media":
      return <MediaRenderer data={block.data} />;
    case "rawHtml":
      return <RawHtmlRenderer data={block.data} />;
  }
}

/**
 * Parse raw stored blocks into validated ones, dropping any that no longer match
 * their schema. Exported so the schema engine and the renderer agree on exactly
 * which blocks "count" for a given page.
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

/** The composed page body. */
export function BlockRenderer({ blocks }: { blocks: BlockInput[] }) {
  if (!blocks.length) return null;
  return (
    <div className="space-y-10">
      {blocks.map((block, i) => (
        <div key={i}>{renderBlock(block)}</div>
      ))}
    </div>
  );
}
