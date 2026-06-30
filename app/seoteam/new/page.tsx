import type { Metadata } from "next";

import { NewPostFlow } from "@/components/seoteam/new-post-flow";

export const metadata: Metadata = {
  title: "New post · SEO Team",
  robots: { index: false, follow: false },
};

export default function NewPostPage() {
  return <NewPostFlow />;
}
