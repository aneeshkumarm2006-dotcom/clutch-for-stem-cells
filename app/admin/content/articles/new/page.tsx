/**
 * New article `/admin/content/articles/new` (PRD §8.6 / Stage 6.8).
 */
import {
  ArticleForm,
  emptyArticle,
} from "@/components/admin/content/article-form";
import { getTaxonomyOptions } from "@/lib/admin/lookups";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const taxonomy = await getTaxonomyOptions();
  return (
    <ArticleForm
      mode="create"
      defaultValues={emptyArticle()}
      options={{
        conditions: taxonomy.conditions,
        treatments: taxonomy.treatments,
      }}
    />
  );
}
