"use client";

/**
 * AccountNav — right-side navbar area (Design §10.8). Shows the shortlist link
 * with a live saved-count and the "Find a clinic" CTA. User sign-in is not
 * exposed in the frontend; the saved count comes from the shortlist context
 * (guest localStorage).
 */
import * as React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useShortlist } from "@/lib/hooks/use-shortlist";

export function AccountNav() {
  const { count, ready } = useShortlist();

  return (
    <div className="flex items-center gap-3.5">
      <Link
        href="/shortlist"
        className="relative inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        aria-label={`Shortlist${ready && count ? `, ${count} saved` : ""}`}
      >
        <Heart className="size-[18px]" aria-hidden="true" />
        <span className="hidden xl:inline">Shortlist</span>
        {ready && count > 0 ? (
          <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-tint px-1 text-[11px] font-semibold text-azure-700">
            {count}
          </span>
        ) : null}
      </Link>

      <Button asChild>
        <Link href="/find-a-clinic">Find a clinic</Link>
      </Button>
    </div>
  );
}
