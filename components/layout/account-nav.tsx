"use client";

/**
 * AccountNav — right-side navbar area (Design §10.8). Shows the shortlist link
 * with a live saved-count, then either a "Sign in" link + "Find a clinic" CTA
 * (visitor) or a compact account menu (member). Session comes from NextAuth;
 * the saved count comes from the shortlist context (guest or synced).
 */
import * as React from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Heart, LogOut, User as UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useShortlist } from "@/lib/hooks/use-shortlist";

export function AccountNav() {
  const { data: session, status } = useSession();
  const { count, ready } = useShortlist();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const user = session?.user;

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

      {status === "authenticated" && user ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-text-primary transition-colors hover:border-border-strong focus-visible:outline-none"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-tint text-azure-700">
              <UserIcon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="hidden max-w-[10ch] truncate lg:inline">
              {user.name?.split(" ")[0] ?? "Account"}
            </span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 rounded-lg border border-border bg-surface p-1.5 shadow-lg"
            >
              <MenuLink href="/account">My account</MenuLink>
              <MenuLink href="/shortlist">My shortlist</MenuLink>
              <button
                type="button"
                role="menuitem"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-alt"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <Link
            href="/auth/sign-in"
            className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            Sign in
          </Link>
          <Button asChild>
            <Link href="/find-a-clinic">Find a clinic</Link>
          </Button>
        </>
      )}
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={cn(
        "block rounded-md px-2.5 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-alt",
      )}
    >
      {children}
    </Link>
  );
}
