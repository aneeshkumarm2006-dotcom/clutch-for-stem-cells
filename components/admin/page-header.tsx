import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Admin page topbar (Design §10.13) — sticky 64px header: title (with optional
 * breadcrumb prefix + status chip) on the left, action buttons on the right.
 */
export function PageHeader({
  title,
  breadcrumb,
  badge,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  /** e.g. `{ label: "Clinics", href: "/admin/clinics" }`. */
  breadcrumb?: { label: string; href: string };
  /** Inline chip after the title (e.g. "Unsaved changes"). */
  badge?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned actions. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-surface px-5 py-3 lg:px-7",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {breadcrumb ? (
          <Link
            href={breadcrumb.href}
            className="hidden text-[13px] text-text-muted hover:text-text-secondary sm:inline"
          >
            {breadcrumb.label} /
          </Link>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold tracking-[-0.01em] text-text-primary lg:text-xl">
            {title}
          </h1>
          {description ? (
            <p className="truncate text-[12.5px] text-text-muted">
              {description}
            </p>
          ) : null}
        </div>
        {badge}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2.5">{children}</div>
      ) : null}
    </header>
  );
}
