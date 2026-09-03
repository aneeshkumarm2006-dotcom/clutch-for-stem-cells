import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageLead } from "@/components/common/page-lead";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";
import { JsonLd } from "@/components/seo/json-ld";
import { ToolCard } from "@/components/tools/tool-card";
import { blocksToSchemaOrg } from "@/lib/blocks/schema";
import { getPageContent } from "@/lib/page-content";
import { pageMetadata } from "@/lib/page-metadata";
import { webPageJsonLd } from "@/lib/seo";
import { toolsItemListJsonLd } from "@/lib/tools/schema";
import { TOOLS_HUB, TOOLS_PATH, toolsByCategory } from "@/config/tools";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: TOOLS_PATH });

export default async function ToolsHubPage() {
  const content = await getPageContent(TOOLS_PATH);
  const groups = toolsByCategory();

  const jsonLd = [
    webPageJsonLd({
      name: TOOLS_HUB.title,
      description: TOOLS_HUB.description,
      path: TOOLS_PATH,
      type: "CollectionPage",
    }),
    toolsItemListJsonLd(TOOLS_HUB.title),
    ...blocksToSchemaOrg(content.blocks),
  ];

  return (
    <div className="container max-w-4xl py-8 md:py-12">
      <JsonLd data={jsonLd} />

      <Breadcrumbs
        className="mb-6"
        items={[
          { name: "Home", href: "/" },
          { name: "Tools", href: TOOLS_PATH },
        ]}
      />

      <header>
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-tint px-2.5 py-1 text-xs font-semibold text-azure-700">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {content.extra("eyebrow")}
        </span>
        <h1 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[36px]">
          {content.title}
        </h1>
        <PageLead html={content.lead} className="mt-3 max-w-2xl text-[17px]" />
        <p className="mt-3 text-[13px] text-text-muted">
          {content.extra("intro")}
        </p>
      </header>

      <div className="mt-10 space-y-9">
        {groups.map((group) => (
          <section key={group.category}>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-text-muted">
              {group.category}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <DisclaimerNote className="mt-10" />

      <BlockRenderer
        blocks={content.blocks}
        className="mt-12 border-t border-border pt-10"
      />
    </div>
  );
}
