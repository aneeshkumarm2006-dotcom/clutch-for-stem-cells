import * as React from "react";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageLead } from "@/components/common/page-lead";
import { JsonLd } from "@/components/seo/json-ld";
import { blocksToSchemaOrg } from "@/lib/blocks/schema";
import { staticPageMeta } from "@/config/static-pages";
import { webPageJsonLd, type WebPageType } from "@/lib/seo";
import type { ResolvedPageContent } from "@/lib/page-content";

/**
 * The narrower `WebPage` subtype for the routes that have one. Google reads
 * `AboutPage` and `ContactPage` as distinct page kinds, and on a YMYL site the
 * "who runs this" page being explicitly typed is exactly the sort of provenance
 * signal that is cheap to give and awkward to infer.
 */
const PAGE_TYPES: Record<string, WebPageType> = {
  "/about": "AboutPage",
  "/contact": "ContactPage",
};

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
 *
 * Structured data is emitted here rather than in each route for the same reason
 * the layout is: six pages sharing one component should not be six chances to
 * forget the markup. Before this, `/about`, `/methodology`, `/editorial-policy`
 * and the legal pages carried no JSON-LD at all — which on a YMYL site meant the
 * pages that establish who we are were the ones a crawler could say least about.
 */
export function ProsePage({ content }: { content: ResolvedPageContent }) {
  const meta = staticPageMeta(content.path);
  const jsonLd = [
    webPageJsonLd({
      name: meta?.title ?? content.title,
      description: meta?.description,
      path: content.path,
      type: PAGE_TYPES[content.path],
    }),
    // Whatever the composed body contributes (an FAQ block → FAQPage, a
    // comparison table → ItemList). Editors get this without asking for it.
    ...blocksToSchemaOrg([...content.blocks, ...content.blocksAfter]),
  ];

  return (
    <div className="container max-w-3xl py-10 md:py-14">
      <JsonLd data={jsonLd} />
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
