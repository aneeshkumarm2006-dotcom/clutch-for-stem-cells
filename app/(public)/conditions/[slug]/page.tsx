import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { getDirectoryData, getTaxonomyTermBySlug } from "@/lib/public-data";
import { directoryParamsFrom, isTopView } from "@/lib/directory-query";
import { Directory } from "@/components/directory/directory";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const term = await getTaxonomyTermBySlug("condition", params.slug);
  if (!term) return buildMetadata({ title: "Condition not found" });
  return buildMetadata({
    title: `${term.name} clinics`,
    description:
      term.shortDescription ??
      `Compare clinics treating ${term.name} and read verified patient reviews.`,
    path: `/conditions/${term.slug}`,
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
  const data = await getDirectoryData(queryParams);

  return (
    <Directory
      heading={`Clinics treating ${term.name}`}
      intro={
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
    />
  );
}
