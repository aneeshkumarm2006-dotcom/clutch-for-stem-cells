import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getMatrixPageForEdit,
  getMatrixTaxonomyOptions,
  getReviewerOptions,
} from "@/lib/seoteam/matrix-data";
import {
  MatrixEditor,
  type MatrixEditorValues,
} from "@/components/seoteam/matrix-editor";

export const metadata: Metadata = {
  title: "Edit combination page · SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditMatrixPage({
  params,
}: {
  params: { id: string };
}) {
  const [page, options, reviewers] = await Promise.all([
    getMatrixPageForEdit(params.id),
    getMatrixTaxonomyOptions(),
    getReviewerOptions(),
  ]);
  if (!page) notFound();

  const initial: MatrixEditorValues = {
    kind: page.kind,
    slugA: page.slugA,
    slugB: page.slugB,
    title: page.title,
    metaTitle: page.metaTitle ?? "",
    metaDescription: page.metaDescription ?? "",
    intro: page.intro ?? "",
    body: page.body,
    faqs: page.faqs,
    keyFacts: page.keyFacts.map((k) => ({
      label: k.label,
      value: k.value,
      sourceUrl: k.sourceUrl ?? "",
    })),
    reviewStatus: page.reviewStatus,
    reviewedBy: page.reviewedBy ?? "",
    flagsAcknowledged: page.flagsAcknowledged,
  };

  return (
    <MatrixEditor
      mode="edit"
      pageId={page.id}
      initial={initial}
      reviewers={reviewers}
      options={options}
      existingPath={page.path}
    />
  );
}
