import type { Metadata } from "next";

import {
  getMatrixTaxonomyOptions,
  getReviewerOptions,
} from "@/lib/seoteam/matrix-data";
import {
  MatrixEditor,
  type MatrixEditorValues,
} from "@/components/seoteam/matrix-editor";

export const metadata: Metadata = {
  title: "New combination page · SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const EMPTY: MatrixEditorValues = {
  kind: "treatment_condition",
  slugA: "",
  slugB: "",
  title: "",
  metaTitle: "",
  metaDescription: "",
  intro: "",
  body: "",
  faqs: [],
  keyFacts: [],
  reviewStatus: "draft",
  reviewedBy: "",
  flagsAcknowledged: false,
};

export default async function NewMatrixPage() {
  const [options, reviewers] = await Promise.all([
    getMatrixTaxonomyOptions(),
    getReviewerOptions(),
  ]);
  return (
    <MatrixEditor
      mode="create"
      initial={EMPTY}
      reviewers={reviewers}
      options={options}
    />
  );
}
