import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getReviewerForEdit } from "@/lib/seoteam/reviewer-data";
import {
  ReviewerEditor,
  type ReviewerEditorValues,
} from "@/components/seoteam/reviewer-editor";

export const metadata: Metadata = {
  title: "Edit reviewer · SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditReviewerPage({
  params,
}: {
  params: { id: string };
}) {
  const reviewer = await getReviewerForEdit(params.id);
  if (!reviewer) notFound();

  const initial: ReviewerEditorValues = {
    name: reviewer.name,
    slug: reviewer.slug,
    credentials: reviewer.credentials ?? "",
    title: reviewer.title ?? "",
    bio: reviewer.bio ?? "",
    photo: reviewer.photo,
    sameAs: reviewer.sameAs,
    isActive: reviewer.isActive,
  };

  return (
    <ReviewerEditor mode="edit" reviewerId={reviewer.id} initial={initial} />
  );
}
