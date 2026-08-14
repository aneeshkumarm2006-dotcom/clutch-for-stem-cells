import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getCountries } from "@/lib/public-data";
import { getPageContent } from "@/lib/page-content";
import { buildJsonLd } from "@/lib/schema/engine";
import { getSchemaContext } from "@/lib/schema/context";
import { staticPageMeta } from "@/config/static-pages";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { PageLead } from "@/components/common/page-lead";
import { DestinationCard } from "@/components/taxonomy/taxonomy-card";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/locations" });

export default async function LocationsIndexPage() {
  const [countries, content] = await Promise.all([
    getCountries(),
    getPageContent("/locations"),
  ]);

  const meta = staticPageMeta("/locations");
  const ctx = await getSchemaContext();
  const jsonLd = buildJsonLd(
    "directory",
    {
      name: meta?.title ?? content.title,
      description: meta?.description,
      path: "/locations",
      items: countries.map((c) => ({
        path: `/locations/${c.slug}`,
        name: c.name,
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
          { name: "Destinations", href: "/locations" },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          {content.title}
        </h1>
        <PageLead html={content.lead} className="mt-3" />
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => (
          <DestinationCard
            key={c.id}
            name={c.name}
            slug={c.slug}
            flag={c.flag}
            clinicCount={c.clinicCount}
          />
        ))}
      </div>

      <BlockRenderer
        blocks={content.blocks}
        className="mt-14 max-w-3xl border-t border-border pt-10"
      />
    </div>
  );
}
