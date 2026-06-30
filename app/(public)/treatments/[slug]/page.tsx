import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getDirectoryData, getTaxonomyTermBySlug } from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { Directory } from "@/components/directory/directory";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
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
  const data = await getDirectoryData(queryParams);

  return (
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
    />
  );
}
