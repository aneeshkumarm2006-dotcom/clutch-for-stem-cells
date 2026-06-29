import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { getArticlesPage, titleizeSlug } from "@/lib/public-data";
import { ResourcesIndex } from "@/components/article/resources-index";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const label = titleizeSlug(params.slug);
  return buildMetadata({
    title: `${label} — Resources`,
    description: `Patient guides and articles about ${label.toLowerCase()}.`,
    path: `/resources/category/${params.slug}`,
  });
}

export default async function ResourcesCategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const page = Number(
    Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page,
  ) || 1;
  const data = await getArticlesPage({ category: params.slug, page });

  if (data.total === 0 && page === 1) notFound();

  const label = titleizeSlug(params.slug);
  return (
    <ResourcesIndex
      data={data}
      activeCategory={params.slug}
      title={label}
      intro={`Patient guides and articles about ${label.toLowerCase()}.`}
      basePath={`/resources/category/${params.slug}`}
    />
  );
}
