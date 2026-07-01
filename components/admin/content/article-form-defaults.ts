/**
 * Server-safe default values for the article form.
 *
 * Not a `"use client"` module: the New-article Server Component
 * (`/admin/content/articles/new`) calls `emptyArticle()` on the server. Exports
 * from a `"use client"` file become client-reference stubs when imported into
 * server code, so calling them there throws ("(0 , x) is not a function").
 *
 * `ArticleFormValues` is imported type-only — erased at build time, so this
 * creates no runtime dependency on the client form module.
 */
import type { ArticleFormValues } from "@/components/admin/content/article-form";

export function emptyArticle(): ArticleFormValues {
  return {
    title: "",
    slug: "",
    status: "draft",
    excerpt: "",
    body: "",
    author: { name: "" },
    categories: [],
    tags: [],
    relatedConditionIds: [],
    relatedTreatmentIds: [],
    seo: {},
  };
}
