import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import {
  getCoOccurringTreatments,
  getDirectoryData,
  getRelatedTerms,
  getTaxonomyTermBySlug,
  hasEditorialContent,
} from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import {
  itemListJsonLd,
  medicalConditionJsonLd,
  medicalWebPageJsonLd,
} from "@/lib/seo";
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
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const term = await getTaxonomyTermBySlug("condition", params.slug);
  if (!term) return pageMetadata({ title: "Condition not found" });
  return pageMetadata({
    title: `${term.name} clinics`,
    description:
      term.shortDescription ??
      term.description?.slice(0, 160) ??
      `Compare clinics treating ${term.name} and read verified patient reviews.`,
    path: `/conditions/${term.slug}`,
    seo: term.seo ?? null,
    // Clinic inventory is deliberately NOT an indexation gate: every active
    // taxonomy term is indexable and in the sitemap whether or not any clinic
    // matches it yet, because the term itself is the query we want to own. The
    // trade-off (an empty term can read as a soft 404 to Google) is accepted.
    // Only filtered/sorted/paged variants are withheld.
    noindex: shouldNoindexDirectory(searchParams, { locked: ["condition"] }),
  });
}

export default async function ConditionDirectoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const term = await getTaxonomyTermBySlug("condition", params.slug);
  if (!term) notFound();

  const queryParams = directoryParamsFrom(searchParams, {
    conditions: [term.slug],
  });
  const [data, relatedConditions, relatedTreatments, comboGuides] =
    await Promise.all([
      getDirectoryData(queryParams),
      getRelatedTerms("condition", term.slug),
      getCoOccurringTreatments(term.slug),
      getApprovedComboLinks({ kind: "treatment_condition", slugB: term.slug }),
    ]);

  const path = `/conditions/${term.slug}`;
  const editorial = term.editorial;
  const jsonLd = [
    medicalWebPageJsonLd({
      name: `Clinics treating ${term.name}`,
      description: term.shortDescription ?? term.description,
      path,
      lastReviewed: editorial?.lastReviewedAt,
      dateModified: editorial?.updatedAt,
      reviewedBy: editorial?.reviewer,
      about: medicalConditionJsonLd({
        name: term.name,
        description: term.shortDescription ?? term.description,
        path,
      }),
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
        heading={`Clinics treating ${term.name}`}
        intro={
          term.description ??
          term.shortDescription ??
          `Clinics that treat ${term.name}. Compare accredited providers, the treatments they offer, pricing, and verified patient reviews.`
        }
        basePath={`/conditions/${term.slug}`}
        searchParams={searchParams}
        data={data}
        locked={["condition"]}
        filterLabels={data.filterLabels}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Conditions", href: "/conditions" },
          { name: term.name, href: `/conditions/${term.slug}` },
        ]}
        activeView={isTopView(searchParams) ? "top" : "all"}
        afterResults={
          <>
            {hasEditorialContent(editorial) ? (
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
                  title: "Related conditions",
                  links: relatedConditions.map((c) => ({
                    href: `/conditions/${c.slug}`,
                    label: c.name,
                    meta: clinicCountMeta(c.clinicCount),
                  })),
                },
                {
                  title: `Treatments clinics offer for ${term.name}`,
                  description: `Treatments that clinics treating ${term.name} commonly list. Evidence and suitability vary, so consult a physician.`,
                  links: relatedTreatments.map((t) => ({
                    href: `/treatments/${t.slug}`,
                    label: t.name,
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
