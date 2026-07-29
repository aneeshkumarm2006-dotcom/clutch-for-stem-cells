import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import {
  getCitiesByCountry,
  getCountries,
  getCountryBySlug,
  getDirectoryData,
} from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import { itemListJsonLd, medicalWebPageJsonLd } from "@/lib/seo";
import { editorialJsonLd } from "@/lib/editorial-schema";
import { getApprovedComboLinks } from "@/lib/seoteam/matrix-data";
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
  params: { country: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const country = await getCountryBySlug(params.country);
  if (!country) return pageMetadata({ title: "Destination not found" });
  return pageMetadata({
    title: `Stem cell clinics in ${country.name}`,
    description:
      country.shortDescription ??
      country.description?.slice(0, 160) ??
      `Compare accredited regenerative-medicine clinics in ${country.name} and read verified patient reviews.`,
    path: `/locations/${country.slug}`,
    seo: country.seo ?? null,
    noindex: shouldNoindexDirectory(searchParams, { locked: ["country"] }),
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
  const [data, cities, allCountries, treatmentGuides, conditionGuides] =
    await Promise.all([
      getDirectoryData(queryParams),
      getCitiesByCountry(country.slug),
      getCountries(),
      getApprovedComboLinks({ kind: "treatment_country", slugB: country.slug }),
      getApprovedComboLinks({ kind: "condition_country", slugB: country.slug }),
    ]);
  const otherCountries = allCountries
    .filter((c) => c.slug !== country.slug)
    .sort((a, b) => b.clinicCount - a.clinicCount)
    .slice(0, 8);
  const comboGuides = [...treatmentGuides, ...conditionGuides];

  const path = `/locations/${country.slug}`;
  const editorial = country.editorial;
  const jsonLd = [
    medicalWebPageJsonLd({
      name: `Stem cell clinics in ${country.name}`,
      description: country.shortDescription ?? country.description,
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
        heading={`${country.flag ? `${country.flag} ` : ""}Stem cell clinics in ${country.name}`}
        intro={
          country.description ??
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
        afterResults={
          <>
            {editorial ? (
              <EditorialArticle data={editorial} className="mb-12" />
            ) : null}
            <RelatedLinks
              groups={[
                {
                  title: `In-depth guides for ${country.name}`,
                  links: comboGuides.map((g) => ({
                    href: g.path,
                    label: g.title,
                  })),
                },
                {
                  title: `Cities in ${country.name}`,
                  links: cities.map((c) => ({
                    href: `/locations/${country.slug}/${c.slug}`,
                    label: c.name,
                    meta: clinicCountMeta(c.clinicCount),
                  })),
                },
                {
                  title: "Other destinations",
                  links: otherCountries.map((c) => ({
                    href: `/locations/${c.slug}`,
                    label: `${c.flag ? `${c.flag} ` : ""}${c.name}`,
                    meta: clinicCountMeta(c.clinicCount),
                  })),
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
