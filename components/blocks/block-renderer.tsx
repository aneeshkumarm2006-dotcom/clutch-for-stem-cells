/**
 * Block renderer — turns a stored `blocks` array into page body markup.
 *
 * The switch is exhaustive over the block union, so adding a block type to
 * `lib/validation/block.ts` without adding a renderer here is a *compile error*,
 * not a blank space on a live page.
 *
 * Blocks arriving from the DB are re-parsed through the block schema before
 * rendering (`parseBlocks`, re-exported from `lib/blocks/content.ts`). A legacy
 * or hand-edited row whose `data` no longer matches its type is skipped rather
 * than crashing the page.
 */
import * as React from "react";

import { cn } from "@/lib/utils";
import type { BlockInput } from "@/lib/validation/block";
import {
  CalloutRenderer,
  ChecklistRenderer,
  ComparisonRenderer,
  CtaRenderer,
  FaqRenderer,
  FeatureGridRenderer,
  KeyTakeawaysRenderer,
  LinkListRenderer,
  MediaRenderer,
  ProsConsRenderer,
  QuoteRenderer,
  RawHtmlRenderer,
  RichTextRenderer,
  StatGridRenderer,
  StepsRenderer,
} from "@/components/blocks/renderers";

export { parseBlocks } from "@/lib/blocks/content";

/** Render one validated block. Exhaustive over the union. */
function renderBlock(block: BlockInput): React.ReactNode {
  switch (block.type) {
    case "richText":
      return <RichTextRenderer data={block.data} />;
    case "keyTakeaways":
      return <KeyTakeawaysRenderer data={block.data} />;
    case "steps":
      return <StepsRenderer data={block.data} />;
    case "checklist":
      return <ChecklistRenderer data={block.data} />;
    case "comparisonTable":
      return <ComparisonRenderer data={block.data} />;
    case "faq":
      return <FaqRenderer data={block.data} />;
    case "featureGrid":
      return <FeatureGridRenderer data={block.data} />;
    case "prosCons":
      return <ProsConsRenderer data={block.data} />;
    case "statGrid":
      return <StatGridRenderer data={block.data} />;
    case "callout":
      return <CalloutRenderer data={block.data} />;
    case "quote":
      return <QuoteRenderer data={block.data} />;
    case "linkList":
      return <LinkListRenderer data={block.data} />;
    case "cta":
      return <CtaRenderer data={block.data} />;
    case "media":
      return <MediaRenderer data={block.data} />;
    case "rawHtml":
      return <RawHtmlRenderer data={block.data} />;
  }
}

/** The composed body. */
export function BlockRenderer({
  blocks,
  className,
}: {
  blocks: BlockInput[];
  className?: string;
}) {
  if (!blocks.length) return null;
  return (
    <div className={cn("space-y-10", className)}>
      {blocks.map((block, i) => (
        <div key={i}>{renderBlock(block)}</div>
      ))}
    </div>
  );
}
