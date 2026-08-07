import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getDirectoryData } from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import { itemListJsonLd } from "@/lib/seo";
import { Directory } from "@/components/directory/directory";
import { JsonLd } from "@/components/seo/json-ld";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { getPageContent } from "@/lib/page-content";

export const generateMetadata = async ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> => {
  const meta = await pageMetadata({
    path: "/clinics",
    noindex: shouldNoindexDirectory(searchParams),
  });
  return {
    ...meta,
    keywords: ["stem cell clinics", "stem cell treatment clinics"],
  };
};

export default async function ClinicsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = directoryParamsFrom(searchParams);
  const [data, content] = await Promise.all([
    getDirectoryData(params),
    getPageContent("/clinics"),
  ]);

  const jsonLd = data.cards.length
    ? [
        itemListJsonLd(
          data.cards.map((c) => ({ path: `/clinic/${c.slug}`, name: c.name })),
        ),
      ]
    : [];

  return (
    <>
      {jsonLd.length ? <JsonLd data={jsonLd} /> : null}
      <Directory
        heading={content.title}
        introHtml={content.lead}
        basePath="/clinics"
        afterResults={
          content.blocks.length ? (
            <BlockRenderer blocks={content.blocks} className="max-w-3xl" />
          ) : null
        }
        searchParams={searchParams}
        data={data}
        filterLabels={data.filterLabels}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Clinics", href: "/clinics" },
        ]}
        activeView={isTopView(searchParams) ? "top" : "all"}
      />
    </>
  );
}
