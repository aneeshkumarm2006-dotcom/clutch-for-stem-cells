import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import {
  getCityBySlug,
  getCountryBySlug,
  getDirectoryData,
} from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { Directory } from "@/components/directory/directory";

export async function generateMetadata({
  params,
}: {
  params: { country: string; city: string };
}): Promise<Metadata> {
  const [country, city] = await Promise.all([
    getCountryBySlug(params.country),
    getCityBySlug(params.city),
  ]);
  if (!country || !city) return buildMetadata({ title: "Destination not found" });
  return buildMetadata({
    title: `Stem cell clinics in ${city.name}, ${country.name}`,
    description: `Compare accredited regenerative-medicine clinics in ${city.name}, ${country.name} and read verified patient reviews.`,
    path: `/locations/${country.slug}/${city.slug}`,
  });
}

export default async function CityDirectoryPage({
  params,
  searchParams,
}: {
  params: { country: string; city: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [country, city] = await Promise.all([
    getCountryBySlug(params.country),
    getCityBySlug(params.city),
  ]);
  if (!country || !city) notFound();

  const queryParams = directoryParamsFrom(searchParams, {
    country: country.name,
    city: city.name,
  });
  const data = await getDirectoryData(queryParams);

  return (
    <Directory
      heading={`Stem cell clinics in ${city.name}`}
      intro={`Accredited regenerative-medicine clinics in ${city.name}, ${country.name}. Compare providers, pricing ranges, and verified patient reviews.`}
      basePath={`/locations/${country.slug}/${city.slug}`}
      searchParams={searchParams}
      data={data}
      locked={["country"]}
      filterLabels={data.filterLabels}
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Destinations", href: "/locations" },
        { name: country.name, href: `/locations/${country.slug}` },
        { name: city.name, href: `/locations/${country.slug}/${city.slug}` },
      ]}
      activeView={isTopView(searchParams) ? "top" : "all"}
    />
  );
}
