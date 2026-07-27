import type { Metadata } from "next";

import { PageEditor, type PageEditorValues } from "@/components/seoteam/page-editor";
import { getReviewerOptions } from "@/lib/seoteam/matrix-data";

export const metadata: Metadata = {
  title: "New page | SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const EMPTY: PageEditorValues = {
  title: "",
  slug: "",
  intro: "",
  blocks: [],
  seo: {},
  schemaOverrides: {},
  reviewStatus: "draft",
  reviewedBy: "",
  flagsAcknowledged: false,
};

export default async function NewComposedPage() {
  const reviewers = await getReviewerOptions();
  return <PageEditor mode="create" initial={EMPTY} reviewers={reviewers} />;
}
