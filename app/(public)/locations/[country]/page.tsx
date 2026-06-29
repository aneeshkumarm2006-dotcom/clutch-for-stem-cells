import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { getCountryBySlug, getDirectoryData } from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { Directory } from "@/components/directory/directory";

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = await getCountryBySlug(params.country);
  if (!country) return buildMetadata({ title: "Destination not found" });
  return buildMetadata({
    title: `Stem cell clinics in ${country.name}`,
    description:
      country.shortDescription ??
      `Compare accredited regenerative-medicine clinics in ${country.name} and read verified patient reviews.`,
    path: `/locations/${country.slug}`,
  });
}

export default async function CountryDirectoryPage({
  params,
  searchParams,
}: {
  params: { country: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const country = await getCountryBySlug(params.country);
  if (!country) notFound();

  const queryParams = directoryParamsFrom(searchParams, {
    country: country.name,
  });
  const data = await getDirectoryData(queryParams);

  return (
    <Directory
      heading={`${country.flag ? `${country.flag} ` : ""}Stem cell clinics in ${country.name}`}
      intro={
        country.shortDescription ??
        `Accredited regenerative-medicine clinics in ${country.name}. Compare providers, pricing ranges, and verified patient reviews.`
      }
      basePath={`/locations/${country.slug}`}
      searchParams={searchParams}
      data={data}
      locked={["country"]}
      filterLabels={data.filterLabels}
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Destinations", href: "/locations" },
        { name: country.name, href: `/locations/${country.slug}` },
      ]}
      activeView={isTopView(searchParams) ? "top" : "all"}
    />
  );
}
