import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getDirectoryData } from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import { itemListJsonLd } from "@/lib/seo";
import { Directory } from "@/components/directory/directory";
import { JsonLd } from "@/components/seo/json-ld";

export const generateMetadata = ({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> =>
  pageMetadata({
    title: "All clinics",
    description:
      "Browse and compare accredited stem cell and regenerative-medicine clinics worldwide by treatment, condition, location, price, and verified reviews.",
    path: "/clinics",
    noindex: shouldNoindexDirectory(searchParams),
  });

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
