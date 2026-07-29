import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import {
  getCitiesByCountry,
  getCityBySlug,
  getCountryBySlug,
  getDirectoryData,
} from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import { itemListJsonLd, medicalWebPageJsonLd } from "@/lib/seo";
import { editorialJsonLd } from "@/lib/editorial-schema";
import { Directory } from "@/components/directory/directory";
import {
  RelatedLinks,
  clinicCountMeta,
} from "@/components/directory/related-links";
import { EditorialArticle } from "@/components/content/editorial-article";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";
import { JsonLd } from "@/components/seo/json-ld";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { country: string; city: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const [country, city] = await Promise.all([
    getCountryBySlug(params.country),
    getCityBySlug(params.city),
  ]);
  if (!country || !city)
    return pageMetadata({ title: "Destination not found" });
  return pageMetadata({
    title: `Stem cell clinics in ${city.name}, ${country.name}`,
    description:
      city.shortDescription ??
      city.description?.slice(0, 160) ??
      `Compare accredited regenerative-medicine clinics in ${city.name}, ${country.name} and read verified patient reviews.`,
    path: `/locations/${country.slug}/${city.slug}`,
    seo: city.seo ?? null,
    noindex: shouldNoindexDirectory(searchParams, { locked: ["country"] }),
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
  const [data, cities] = await Promise.all([
    getDirectoryData(queryParams),
    getCitiesByCountry(country.slug),
  ]);
  const otherCities = cities.filter((c) => c.slug !== city.slug);

  const path = `/locations/${country.slug}/${city.slug}`;
  const editorial = city.editorial;
  const jsonLd = [
    medicalWebPageJsonLd({
      name: `Stem cell clinics in ${city.name}, ${country.name}`,
      description: city.shortDescription ?? city.description,
      path,
      lastReviewed: editorial?.lastReviewedAt,
      dateModified: editorial?.updatedAt,
      reviewedBy: editorial?.reviewer,
    }),
    ...editorialJsonLd(editorial),
    ...(data.cards.length
      ? [
          itemListJsonLd(
            data.cards.map((c) => ({
              path: `/clinic/${c.slug}`,
              name: c.name,
            })),
          ),
        ]
      : []),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <Directory
        heading={`Stem cell clinics in ${city.name}`}
        intro={
          city.description ??
          city.shortDescription ??
          `Accredited regenerative-medicine clinics in ${city.name}, ${country.name}. Compare providers, pricing ranges, and verified patient reviews.`
        }
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
        afterResults={
          <>
            {editorial ? (
              <EditorialArticle data={editorial} className="mb-12" />
            ) : null}
            <RelatedLinks
              groups={[
                {
                  title: `More destinations in ${country.name}`,
                  links: [
                    {
                      href: `/locations/${country.slug}`,
                      label: `All clinics in ${country.name}`,
                    },
                    ...otherCities.map((c) => ({
                      href: `/locations/${country.slug}/${c.slug}`,
                      label: c.name,
                      meta: clinicCountMeta(c.clinicCount),
                    })),
                  ],
                },
              ]}
            />
            <DisclaimerNote variant="medical" className="mt-8" />
          </>
        }
      />
    </>
  );
}
