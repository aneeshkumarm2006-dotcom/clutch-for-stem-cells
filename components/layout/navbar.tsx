"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SearchTypeahead } from "@/components/search/search-typeahead";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

export interface NavLink {
  label: string;
  href: string;
}

/** Default primary navigation (Design §10.8 / Homepage mockup). */
export const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: "Clinics", href: "/clinics" },
  { label: "Treatments", href: "/treatments" },
  { label: "Conditions", href: "/conditions" },
  { label: "Destinations", href: "/locations" },
  { label: "Blog", href: "/blog" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface NavbarProps {
  links?: NavLink[];
  /** Primary CTA (label + href). */
  cta?: { label: string; href: string };
  /** Show the compact search field in the bar (≥ lg). */
  searchInNav?: boolean;
  /** Override the right-side account area (e.g. a signed-in menu). */
  account?: React.ReactNode;
  className?: string;
}

/**
 * Navbar — Design §10.8. Sticky, white, hairline bottom border, subtle shadow
 * once scrolled. Logo + nav links + optional compact search + primary CTA;
 * collapses to a `Menu` button → `Sheet` on mobile.
 */
export function Navbar({
  links = DEFAULT_NAV_LINKS,
  cta = { label: "Find a clinic", href: "/find-a-clinic" },
  searchInNav = false,
  account,
  className,
}: NavbarProps) {
  const pathname = usePathname() ?? "/";
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on route change.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const defaultAccount = (
    <Button asChild>
      <Link href={cta.href}>{cta.label}</Link>
    </Button>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-surface transition-shadow",
        scrolled && "shadow-xs",
        className,
      )}
    >
      <div className="container flex h-[68px] items-center gap-7">
        <Logo size="md" />

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-text-primary",
                  active
                    ? "font-semibold text-text-link"
                    : "text-text-secondary",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {searchInNav ? (
            <SearchTypeahead className="hidden w-[230px] lg:block" />
          ) : null}

          <div className="hidden items-center gap-3.5 lg:flex">
            {account ?? defaultAccount}
          </div>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[86%] flex-col sm:max-w-sm"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo size="md" />
              <nav aria-label="Mobile" className="mt-6 flex flex-col">
                {links.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <SheetClose asChild key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "border-b border-border py-3 text-[15px] font-medium transition-colors",
                          active ? "text-text-link" : "text-text-primary",
                        )}
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>

              <div className="mt-auto flex flex-col gap-3 pt-6">
                <SheetClose asChild>
                  <Button asChild className="w-full">
                    <Link href={cta.href}>{cta.label}</Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
