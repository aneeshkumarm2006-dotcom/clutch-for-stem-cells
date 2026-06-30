import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getDirectoryData } from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { Directory } from "@/components/directory/directory";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "All clinics",
    description:
      "Browse and compare accredited stem cell and regenerative-medicine clinics worldwide by treatment, condition, location, price, and verified reviews.",
    path: "/clinics",
  });

export default async function ClinicsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = directoryParamsFrom(searchParams);
  const data = await getDirectoryData(params);

  return (
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
  );
}
