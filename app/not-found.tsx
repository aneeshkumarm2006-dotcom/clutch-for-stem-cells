/**
 * Global 404 (Stage 9.7 / PRD §13 reliability — graceful empty states).
 * Rendered by `notFound()` across the app and for unmatched routes.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-tint text-azure-700">
        <Compass className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-display text-2xl font-bold text-text-primary">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-2 max-w-md text-[15px] text-text-secondary">
        The page may have moved or never existed. Try searching for a clinic, or
        head back to the homepage.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/clinics">Browse clinics</Link>
        </Button>
      </div>
    </div>
  );
}
