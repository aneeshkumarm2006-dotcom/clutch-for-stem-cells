import Link from "next/link";
import { FileText, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/config/site";
import { LogoutButton } from "@/components/seoteam/logout-button";

/** Authenticated dashboard top bar: brand, nav, and sign-out. */
export function SeoTeamHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          href="/seoteam"
          className="flex items-center gap-2 font-display text-[15px] font-bold tracking-[-0.01em] text-text-primary"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
            {SITE_NAME.charAt(0)}
          </span>
          <span className="truncate">SEO Studio</span>
        </Link>
      </div>
      <div className="flex items-center gap-1.5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/seoteam">
            <FileText className="size-4" />
            <span className="hidden sm:inline">Posts</span>
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/seoteam/new">
            <PlusCircle className="size-4" />
            <span className="hidden sm:inline">New post</span>
          </Link>
        </Button>
        <LogoutButton />
      </div>
    </header>
  );
}
