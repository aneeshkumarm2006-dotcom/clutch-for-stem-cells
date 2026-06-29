import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { ShortlistView } from "@/components/shortlist/shortlist-view";

export const metadata: Metadata = buildMetadata({
  title: "Your shortlist",
  description: "Clinics you've saved to compare.",
  path: "/shortlist",
});

export default function ShortlistPage() {
  return (
    <div className="container py-10 md:py-14">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          Your shortlist
        </h1>
        <p className="mt-2 text-[15px] text-text-secondary">
          Clinics you&apos;ve saved. Sign in to keep your shortlist across
          devices.
        </p>
      </header>
      <ShortlistView />
    </div>
  );
}
