import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getDirectoryData } from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import { buildJsonLd } from "@/lib/schema/engine";
import { getSchemaContext } from "@/lib/schema/context";
import { staticPageMeta } from "@/config/static-pages";
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

  // `CollectionPage` + a typed `ItemList`, not a bare list: the page node names
  // what this URL is, and each entry's `@id` is the same `…#clinic` node that
  // clinic's own profile publishes, so the directory and the profiles describe
  // one set of entities rather than two overlapping ones.
  const meta = staticPageMeta("/clinics");
  const ctx = await getSchemaContext();
  const jsonLd = buildJsonLd(
    "directory",
    {
      name: meta?.title ?? content.title,
      description: meta?.description,
      path: "/clinics",
      items: data.cards.map((c) => ({
        path: `/clinic/${c.slug}`,
        name: c.name,
      })),
      itemType: "MedicalClinic",
      itemIdFragment: "clinic",
      itemsName: content.title,
    },
    ctx,
  );

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
