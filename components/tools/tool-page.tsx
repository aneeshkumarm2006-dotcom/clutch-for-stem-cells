import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageLead } from "@/components/common/page-lead";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";
import { JsonLd } from "@/components/seo/json-ld";
import { RelatedTools } from "@/components/tools/tool-card";
import { ToolIcon } from "@/components/tools/tool-icon";
import { blocksToSchemaOrg } from "@/lib/blocks/schema";
import { getPageContent } from "@/lib/page-content";
import { webPageJsonLd } from "@/lib/seo";
import { calculatorJsonLd } from "@/lib/tools/schema";
import {
  TOOLS_PATH,
  relatedTools,
  toolPath,
  type ToolDef,
} from "@/config/tools";

/**
 * The shared layout every calculator route renders into.
 *
 * A route file supplies its tool definition and its widget; everything else,
 * the CMS-resolved copy, the breadcrumb trail, the structured data, the
 * disclaimer and the cross-links, is handled once here. That is what keeps
 * eleven pages consistent, and it means a fix to the schema or the trail lands
 * on all of them rather than on the ten somebody remembered.
 *
 * Content is fetched here rather than passed in because every tool resolves it
 * the same way, from the same registry key. A route that had to remember to
 * fetch its own copy is a route that can forget.
 */
export async function ToolPage({
  tool,
  children,
  /** Rendered between the widget and the explainer, for tool-specific CTAs. */
  afterCalculator,
}: {
  tool: ToolDef;
  children: React.ReactNode;
  afterCalculator?: React.ReactNode;
}) {
  const path = toolPath(tool.slug);
  const content = await getPageContent(path);

  const jsonLd = [
    webPageJsonLd({
      name: tool.title,
      description: tool.description,
      path,
    }),
    calculatorJsonLd(tool),
    // The explainer contributes nothing, the FAQ block contributes `FAQPage`.
    // Editors get that by composing the page, not by asking for markup.
    ...blocksToSchemaOrg(content.blocks),
  ];

  return (
    <div className="container max-w-3xl py-8 md:py-12">
      <JsonLd data={jsonLd} />

      <Breadcrumbs
        className="mb-6"
        items={[
          { name: "Home", href: "/" },
          { name: "Tools", href: TOOLS_PATH },
          { name: tool.name, href: path },
        ]}
      />

      <header>
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-tint px-2.5 py-1 text-xs font-semibold text-azure-700">
          <ToolIcon icon={tool.icon} className="size-3.5" />
          {content.extra("eyebrow")}
        </span>
        <h1 className="mt-3 font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[34px]">
          {content.title}
        </h1>
        <PageLead html={content.lead} className="mt-3 text-[17px]" />
      </header>

      <div className="mt-7">{children}</div>

      {afterCalculator}

      <DisclaimerNote className="mt-6" />

      <BlockRenderer
        blocks={content.blocks}
        className="mt-12 border-t border-border pt-10"
      />

      <RelatedTools tools={relatedTools(tool.slug)} />
    </div>
  );
}

/**
 * The soft call to action a calculator can render under its result.
 *
 * Soft on purpose. Gating a result behind an email would lift capture and cost
 * the page the thing it is there for: somebody who bounces at a form wall does
 * not come back, and a search engine reads that bounce. The link goes to the
 * directory, pre-filtered where the tool knows enough to filter it.
 */
export function ToolCta({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border bg-surface-alt p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 md:p-5">
      <div className="min-w-0">
        <p className="font-display text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
          {title}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
          {description}
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-[18px] text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {label}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
