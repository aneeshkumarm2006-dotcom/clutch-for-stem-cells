/**
 * Edit article `/admin/content/articles/[id]` (PRD §8.6 / Stage 6.8).
 */
import { notFound } from "next/navigation";

import {
  ArticleForm,
  type ArticleFormValues,
} from "@/components/admin/content/article-form";
import { getAdminArticleFormData } from "@/lib/admin/articles";
import { getTaxonomyOptions } from "@/lib/admin/lookups";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: { id: string };
}) {
  const [data, taxonomy] = await Promise.all([
    getAdminArticleFormData(params.id),
    getTaxonomyOptions(),
  ]);
  if (!data) notFound();

  return (
    <ArticleForm
      mode="edit"
      articleId={data.id}
      slug={data.values.slug as string}
      defaultValues={data.values as unknown as ArticleFormValues}
      options={{
        conditions: taxonomy.conditions,
        treatments: taxonomy.treatments,
      }}
    />
  );
}
