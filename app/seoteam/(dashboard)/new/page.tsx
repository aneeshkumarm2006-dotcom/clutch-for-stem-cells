import type { Metadata } from "next";

import { getReviewerOptions } from "@/lib/seoteam/blog-data";
import { NewPostFlow } from "@/components/seoteam/new-post-flow";

export const metadata: Metadata = {
  title: "New post · SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const reviewers = await getReviewerOptions();
  return <NewPostFlow reviewers={reviewers} />;
}
