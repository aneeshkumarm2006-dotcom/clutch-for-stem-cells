/**
 * Curated clinic landing pages — `/clinics/{slug}`.
 *
 * Backed by a `ClinicLanding` record (see `models/clinic-landing.ts`), which
 * carries only the page's copy, meta, and a set of pinned directory filters.
 * The listing itself is the shared `<Directory>` every other directory route
 * renders, so ranking, facets, pagination, and card markup can't diverge here.
 *
 * A page exists only when an active record exists — no record, no URL, so the
 * route can never generate an empty combinatorial long tail on its own.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getDirectoryData } from "@/lib/public-data";
import {
  getClinicLanding,
  getClinicLandingSlugs,
  landingFilterOverrides,
  landingIndexationLocks,
  landingRailLocks,
} from "@/lib/clinic-landings";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { shouldNoindexDirectory } from "@/lib/seo-indexation";
import { faqPageJsonLd, itemListJsonLd, medicalWebPageJsonLd } from "@/lib/seo";
import { Directory } from "@/components/directory/directory";
import { FaqSection } from "@/components/content/faq-section";
import { DisclaimerNote } from "@/components/compliance/disclaimer-note";
import { JsonLd } from "@/components/seo/json-ld";

export const revalidate = 600;

export async function generateStaticParams() {
  // Best-effort: a build-time DB outage degrades to on-demand rendering rather
  // than failing the build (same fallback as the clinic + composed-page routes).
  try {
    const slugs = await getClinicLandingSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const landing = await getClinicLanding(params.slug);
  // 404s here rather than returning a "not found" title, so the status line and
  // the body agree. This route must also stay outside any parent `loading.tsx`
  // boundary or the 200 is flushed before `notFound()` can run — see the note in
  // `clinics/(index)/README.md`.
  if (!landing) notFound();

  // A landing page whose filters currently match nothing is a thin page — it
  // still renders (the copy and FAQs are useful, and the URL must not churn),
  // but it stays `noindex, follow` until there is inventory behind it. The
  // sitemap applies the same test, so the two can never disagree.
  const { total } = await getDirectoryData({
    ...landingFilterOverrides(landing),
    pageSize: 1,
  });

  return pageMetadata({
    title: landing.heading,
    description: landing.intro,
    path: landing.path,
    seo: landing.seo,
    noindex:
      total === 0 ||
      shouldNoindexDirectory(searchParams, {
        locked: landingIndexationLocks(landing),
      }),
  });
}

export default async function ClinicLandingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // `generateMetadata` has already 404'd an unknown slug; this is the type
  // narrowing (and the guard if the component ever renders standalone).
  const landing = await getClinicLanding(params.slug);
  if (!landing) notFound();

  const queryParams = directoryParamsFrom(
    searchParams,
    landingFilterOverrides(landing),
  );
  const data = await getDirectoryData(queryParams);

  const jsonLd = [
    medicalWebPageJsonLd({
      name: landing.heading,
      description: landing.intro,
      path: landing.path,
      dateModified: landing.updatedAt,
    }),
    ...(landing.faqs.length ? [faqPageJsonLd(landing.faqs)] : []),
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
        heading={landing.heading}
        intro={landing.intro}
        basePath={landing.path}
        searchParams={searchParams}
        data={data}
        locked={landingRailLocks(landing)}
        filterLabels={data.filterLabels}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Clinics", href: "/clinics" },
          { name: landing.name, href: landing.path },
        ]}
        activeView={isTopView(searchParams) ? "top" : "all"}
        afterResults={
          <>
            <FaqSection items={landing.faqs} className="mb-12" />
            <DisclaimerNote variant="medical" className="mt-8" />
          </>
        }
      />
    </>
  );
}
