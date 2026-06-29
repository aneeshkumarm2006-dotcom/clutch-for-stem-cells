import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { getArticlesPage } from "@/lib/public-data";
import { ResourcesIndex } from "@/components/article/resources-index";

export const revalidate = 600;

export const metadata: Metadata = buildMetadata({
  title: "Patient resources",
  description:
    "Plain-language guides to regenerative medicine: treatments, medical travel, costs, and questions to ask a clinic.",
  path: "/resources",
});

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const page = Number(
    Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page,
  ) || 1;
  const data = await getArticlesPage({ page });

  return (
    <ResourcesIndex
      data={data}
      title="Patient resources"
      intro="Plain-language guides to help you research regenerative medicine, compare clinics, and ask the right questions."
      basePath="/resources"
    />
  );
}
