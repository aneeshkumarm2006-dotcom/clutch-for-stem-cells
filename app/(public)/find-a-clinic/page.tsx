import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { getConditions, getTreatments, getCountries } from "@/lib/public-data";
import { FindClinicWizard } from "@/components/find/find-clinic-wizard";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageLead } from "@/components/common/page-lead";
import { getPageContent } from "@/lib/page-content";
import { StaticPageSchema } from "@/components/seo/static-page-schema";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/find-a-clinic" });

export default async function FindAClinicPage() {
  const [conditions, treatments, countries, content] = await Promise.all([
    getConditions(),
    getTreatments(),
    getCountries(),
    getPageContent("/find-a-clinic"),
  ]);

  return (
    <div
      style={{
        background:
          "radial-gradient(120% 70% at 50% -10%, #E1F0FC, #F2F8FD 55%)",
      }}
    >
      <StaticPageSchema path="/find-a-clinic" />
      <div className="container max-w-2xl py-10 md:py-14">
        <header className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-tint px-2.5 py-1 text-xs font-semibold text-azure-700">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {content.extra("eyebrow")}
          </span>
          <h1 className="mt-3 font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
            {content.title}
          </h1>
          <PageLead
            html={content.lead}
            className="mx-auto mt-2 max-w-md"
          />
        </header>

        <FindClinicWizard
          conditions={conditions.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
          }))}
          treatments={treatments.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
          }))}
          countries={countries.map((c) => ({ name: c.name, slug: c.slug }))}
        />

        <BlockRenderer
          blocks={content.blocks}
          className="mt-14 border-t border-border pt-10"
        />
      </div>
    </div>
  );
}
