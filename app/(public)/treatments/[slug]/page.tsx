import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import {
  getCoOccurringConditions,
  getDirectoryData,
  getRelatedTerms,
  getTaxonomyTermBySlug,
} from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import {
  faqPageJsonLd,
  itemListJsonLd,
  medicalTherapyJsonLd,
  medicalWebPageJsonLd,
} from "@/lib/seo";
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
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const term = await getTaxonomyTermBySlug("treatment", params.slug);
  if (!term) return pageMetadata({ title: "Treatment not found" });
  return pageMetadata({
    title: `${term.name} clinics`,
    description:
      term.shortDescription ??
      term.description?.slice(0, 160) ??
      `Compare clinics offering ${term.name} and read verified patient reviews.`,
    path: `/treatments/${term.slug}`,
    seo: term.seo ?? null,
    noindex: shouldNoindexDirectory(searchParams, { locked: ["treatment"] }),
  });
}

export default async function TreatmentDirectoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const term = await getTaxonomyTermBySlug("treatment", params.slug);
  if (!term) notFound();

  const queryParams = directoryParamsFrom(searchParams, {
    treatments: [term.slug],
  });
  const [data, relatedTreatments, relatedConditions, comboGuides] =
    await Promise.all([
      getDirectoryData(queryParams),
      getRelatedTerms("treatment", term.slug),
      getCoOccurringConditions(term.slug),
      getApprovedComboLinks({ kind: "treatment_condition", slugA: term.slug }),
    ]);

  const path = `/treatments/${term.slug}`;
  const editorial = term.editorial;
  const jsonLd = [
    medicalWebPageJsonLd({
      name: `${term.name} clinics`,
      description: term.shortDescription ?? term.description,
      path,
      lastReviewed: editorial?.lastReviewedAt,
      dateModified: editorial?.updatedAt,
      reviewedBy: editorial?.reviewer,
      about: medicalTherapyJsonLd({
        name: term.name,
        description: term.shortDescription ?? term.description,
        path,
      }),
    }),
    ...(editorial?.faqs.length ? [faqPageJsonLd(editorial.faqs)] : []),
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
        heading={`${term.name} clinics`}
        intro={
          term.description ??
          term.shortDescription ??
          `Clinics offering ${term.name}. Compare accredited providers, pricing ranges, and verified patient reviews.`
        }
        basePath={`/treatments/${term.slug}`}
        searchParams={searchParams}
        data={data}
        locked={["treatment"]}
        filterLabels={data.filterLabels}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Treatments", href: "/treatments" },
          { name: term.name, href: `/treatments/${term.slug}` },
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
                  title: `In-depth: ${term.name} guides`,
                  links: comboGuides.map((g) => ({
                    href: g.path,
                    label: g.title,
                  })),
                },
                {
                  title: "Related treatments",
                  links: relatedTreatments.map((t) => ({
                    href: `/treatments/${t.slug}`,
                    label: t.name,
                    meta: clinicCountMeta(t.clinicCount),
                  })),
                },
                {
                  title: `Conditions paired with ${term.name}`,
                  description: `Conditions that clinics offering ${term.name} also list — not a statement that ${term.name} treats them.`,
                  links: relatedConditions.map((c) => ({
                    href: `/conditions/${c.slug}`,
                    label: c.name,
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
