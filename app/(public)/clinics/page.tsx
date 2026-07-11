import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getDirectoryData } from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import { itemListJsonLd } from "@/lib/seo";
import { Directory } from "@/components/directory/directory";
import { JsonLd } from "@/components/seo/json-ld";

export const generateMetadata = async ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> => {
  const meta = await pageMetadata({
    // Keyword-aligned with the target "stem cell clinics" and the on-page H1,
    // giving a strong, non-thin title tag for the main directory.
    title: "Stem Cell Clinics",
    description:
      "Browse and compare verified stem cell clinics and stem cell treatment clinics worldwide by treatment, condition, location, and patient reviews.",
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
  const data = await getDirectoryData(params);

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
        heading="Stem cell & regenerative-medicine clinics"
        intro="Compare accredited clinics worldwide. Filter by treatment, condition, cell source, location, price, and verified patient reviews — every result is ranked by our published methodology."
        basePath="/clinics"
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
