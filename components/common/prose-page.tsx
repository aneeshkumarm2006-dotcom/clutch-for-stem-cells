import * as React from "react";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageLead } from "@/components/common/page-lead";
import type { ResolvedPageContent } from "@/lib/page-content";

/**
 * ProsePage — shared layout for the static / legal / trust pages (PRD §6.9).
 * Centered column with a title, optional lead paragraph, a "Last updated" line,
 * and the composed body.
 *
 * Every field comes from `PageContent` (resolved over the shipped copy in
 * `config/editable-pages.ts`), so these pages are edited in
 * `/admin/content/site-pages` rather than in code. The body is a block
 * composition like any other page's, which means an editor can add an FAQ, a
 * callout, or a comparison table to a legal page without a developer, and the
 * structured data those blocks carry follows automatically.
 */
export function ProsePage({ content }: { content: ResolvedPageContent }) {
  return (
    <div className="container max-w-3xl py-10 md:py-14">
      <header className="border-b border-border pb-6">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[34px]">
          {content.title}
        </h1>
        <PageLead html={content.lead} className="mt-3 text-[17px]" />
        {content.updated ? (
          <p className="mt-3 text-[12.5px] text-text-muted">
            Last updated {content.updated}
          </p>
        ) : null}
      </header>

      {content.legalReview ? (
        <p className="mt-6 rounded-md bg-warning-bg px-4 py-3 text-[12.5px] leading-relaxed text-[#8A5A00]">
          This is placeholder content provided for product completeness and is
          flagged for review by a qualified professional before launch.
        </p>
      ) : null}

      <BlockRenderer blocks={content.blocks} className="mt-6" />
    </div>
  );
}
