import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * DirectoryTabs — Design §10.10. Underline-style tabs rendered as **crawlable**
 * `<Link>`s (the directory's All / Top clinics / guides views are distinct
 * URLs). Active tab: `text-primary` + 2px `azure-600` underline; inactive:
 * `text-secondary`. Scrolls horizontally on mobile.
 *
 * For in-page (non-navigational) tabs, use the Radix `Tabs` primitive instead.
 */
export interface DirectoryTab {
  label: string;
  href: string;
  /** Stable id compared against `activeValue` to mark the active tab. */
  value: string;
}

export interface DirectoryTabsProps {
  tabs: DirectoryTab[];
  activeValue: string;
  className?: string;
  /** Accessible label for the nav landmark. */
  label?: string;
}

export function DirectoryTabs({
  tabs,
  activeValue,
  className,
  label = "Directory views",
}: DirectoryTabsProps) {
  return (
    <nav aria-label={label} className={cn("border-b border-border", className)}>
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.value === activeValue;
          return (
            <li key={tab.value} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary text-text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
