import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageEditor, type PageEditorValues } from "@/components/seoteam/page-editor";
import { getPageForEdit } from "@/lib/seoteam/page-data";
import { getReviewerOptions } from "@/lib/seoteam/matrix-data";

export const metadata: Metadata = {
  title: "Edit page · SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditComposedPage({
  params,
}: {
  params: { id: string };
}) {
  const [page, reviewers] = await Promise.all([
    getPageForEdit(params.id),
    getReviewerOptions(),
  ]);
  if (!page) notFound();

  const initial: PageEditorValues = {
    title: page.title,
    slug: page.slug,
    intro: page.intro,
    blocks: page.blocks,
    seo: page.seo,
    schemaOverrides: page.schemaOverrides,
    reviewStatus: page.reviewStatus,
    reviewedBy: page.reviewedBy,
    flagsAcknowledged: page.flagsAcknowledged,
  };

  return (
    <PageEditor
      mode="edit"
      pageId={page.id}
      initial={initial}
      reviewers={reviewers}
    />
  );
}
