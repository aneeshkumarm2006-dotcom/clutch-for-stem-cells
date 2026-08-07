import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";

import { faqPageJsonLd, renderJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/page-metadata";
import { getPageContent } from "@/lib/page-content";
import { blocksFaqs } from "@/lib/blocks/content";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageLead } from "@/components/common/page-lead";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/faq" });

export default async function FaqPage() {
  const content = await getPageContent("/faq");

  // The accordion and the FAQPage JSON-LD read the same blocks, so a question
  // added in the admin is answered on the page and in the structured data
  // without a second place to keep in sync. Non-FAQ blocks in the slot still
  // render (below), they just contribute nothing to the schema.
  const faqs = blocksFaqs(content.blocks);
  const prose = content.blocks.filter((b) => b.type !== "faq");

  return (
    <>
      {faqs.length ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: renderJsonLd(faqPageJsonLd(faqs)) }}
        />
      ) : null}
      <div className="container max-w-3xl py-10 md:py-14">
        <header className="mb-8">
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[34px]">
            {content.title}
          </h1>
          <PageLead html={content.lead} className="mt-3 text-[16px]" />
        </header>

        {faqs.length ? (
          <div className="divide-y divide-border rounded-xl border border-border bg-surface">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group p-5 [&_summary]:list-none"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-[15.5px] font-semibold text-text-primary">
                  {faq.question}
                  <ChevronDown
                    className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 text-[14.5px] leading-relaxed text-text-secondary">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        ) : null}

        <BlockRenderer blocks={prose} className="mt-10" />
        <BlockRenderer
          blocks={content.blocksAfter}
          className="mt-12 border-t border-border pt-10"
        />
      </div>
    </>
  );
}
