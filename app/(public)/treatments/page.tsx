import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getTreatments, type TaxonomyTerm } from "@/lib/public-data";
import { getPageContent } from "@/lib/page-content";
import { buildJsonLd } from "@/lib/schema/engine";
import { getSchemaContext } from "@/lib/schema/context";
import { staticPageMeta } from "@/config/static-pages";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { TaxonomyCard } from "@/components/taxonomy/taxonomy-card";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageLead } from "@/components/common/page-lead";

export const revalidate = 3600;

export const generateMetadata = async (): Promise<Metadata> => {
  const meta = await pageMetadata({ path: "/treatments" });
  return {
    ...meta,
    keywords: [
      "stem cell treatment",
      "systemic cell therapy",
      "stem cell therapy types",
    ],
  };
};

function groupByCategory(terms: TaxonomyTerm[]): [string, TaxonomyTerm[]][] {
  const groups = new Map<string, TaxonomyTerm[]>();
  for (const t of terms) {
    const key = t.category ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return [...groups.entries()];
}

export default async function TreatmentsIndexPage() {
  const [treatments, content] = await Promise.all([
    getTreatments(),
    getPageContent("/treatments"),
  ]);
  const groups = groupByCategory(treatments);

  // `CollectionPage` + `ItemList`. The entries are topic pages rather than
  // entities, so they stay plain `ListItem`s: the therapy entity itself is
  // described on its own page, and duplicating a half-built `MedicalTherapy`
  // node here would compete with the full one.
  const meta = staticPageMeta("/treatments");
  const ctx = await getSchemaContext();
  const jsonLd = buildJsonLd(
    "directory",
    {
      name: meta?.title ?? content.title,
      description: meta?.description,
      path: "/treatments",
      items: treatments.map((t) => ({
        path: `/treatments/${t.slug}`,
        name: t.name,
      })),
      itemsName: content.title,
    },
    ctx,
  );

  return (
    <div className="container py-10 md:py-14">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        className="mb-4"
        items={[
          { name: "Home", href: "/" },
          { name: "Treatments", href: "/treatments" },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          {content.title}
        </h1>
        <PageLead html={content.lead} className="mt-3" />
      </header>

      <div className="mt-10 space-y-10">
        {groups.map(([category, terms]) => (
          <section key={category}>
            <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
              {category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {terms.map((t) => (
                <TaxonomyCard key={t.id} term={t} basePath="/treatments" />
              ))}
            </div>
          </section>
        ))}
      </div>

      <BlockRenderer
        blocks={content.blocks}
        className="mt-14 max-w-3xl border-t border-border pt-10"
      />
    </div>
  );
}
