import type { Metadata } from "next";

import {
  ReviewerEditor,
  type ReviewerEditorValues,
} from "@/components/seoteam/reviewer-editor";

export const metadata: Metadata = {
  title: "New reviewer · SEO Team",
  robots: { index: false, follow: false },
};

const EMPTY: ReviewerEditorValues = {
  name: "",
  slug: "",
  credentials: "",
  title: "",
  bio: "",
  photo: undefined,
  sameAs: [],
  isActive: true,
};

export default function NewReviewerPage() {
  return <ReviewerEditor mode="create" initial={EMPTY} />;
}
