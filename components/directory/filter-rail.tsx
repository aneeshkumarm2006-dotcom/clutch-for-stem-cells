"use client";

import * as React from "react";
import Link from "next/link";
import { SlidersHorizontal, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * FilterRail — Design §5.3 / Directory mockup. A sticky 280px filter rail on
 * desktop; a bottom-sheet drawer on mobile (triggered by a "Filters" button).
 *
 * The same `children` (filter groups) render in both surfaces — keep the
 * controls id-light (wrap inputs in `<label>` rather than using `id`) so the two
 * copies don't collide. Filter state itself lives in the URL (TODO 5.2); this
 * component only provides the responsive shell, header, and "Clear all" / apply
 * affordances.
 */
export interface FilterRailProps {
  children: React.ReactNode;
  title?: string;
  /** Number of clinics matching the current filters (mobile apply button). */
  resultCount?: number;
  /** Active-filter count, shown on the mobile trigger ("Filters · 3"). */
  activeCount?: number;
  /** Reset handler — renders a "Clear all" button when provided. */
  onClearAll?: () => void;
  /** Alternative reset: a link to the unfiltered URL (used when no handler). */
  clearAllHref?: string;
  className?: string;
}

function ClearAll({
  onClearAll,
  clearAllHref,
}: Pick<FilterRailProps, "onClearAll" | "clearAllHref">) {
  if (onClearAll) {
    return (
      <button
        type="button"
        onClick={onClearAll}
        className="text-[13px] font-semibold text-text-link transition-colors hover:text-primary focus-visible:outline-none"
      >
        Clear all
      </button>
    );
  }
  if (clearAllHref) {
    return (
      <Link
        href={clearAllHref}
        className="text-[13px] font-semibold text-text-link transition-colors hover:text-primary"
      >
        Clear all
      </Link>
    );
  }
  return null;
}

export function FilterRail({
  children,
  title = "Filters",
  resultCount,
  activeCount,
  onClearAll,
  clearAllHref,
  className,
}: FilterRailProps) {
  const header = (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 font-display text-base font-semibold text-text-primary">
        <SlidersHorizontal
          className="size-[17px] text-primary"
          aria-hidden="true"
        />
        {title}
      </span>
      <ClearAll onClearAll={onClearAll} clearAllHref={clearAllHref} />
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        aria-label={title}
        className={cn(
          "hidden w-[280px] shrink-0 rounded-xl border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-24 lg:block lg:self-start",
          className,
        )}
      >
        {header}
        <div className="mt-4">{children}</div>
      </aside>

      {/* Mobile trigger + bottom-sheet drawer */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary" className="w-full lg:hidden">
            <SlidersHorizontal
              className="size-4 text-primary"
              aria-hidden="true"
            />
            {title}
            {activeCount ? ` · ${activeCount}` : ""}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[82vh] overflow-y-auto p-0"
        >
          <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-border" />
          <div className="px-5 pb-5 pt-4">
            <SheetTitle className="sr-only">{title}</SheetTitle>
            {header}
            <div className="mt-4">{children}</div>
          </div>
          <div className="sticky bottom-0 border-t border-border bg-surface p-4">
            <SheetClose asChild>
              <Button className="w-full">
                {resultCount == null
                  ? "Show results"
                  : `Show ${resultCount} ${resultCount === 1 ? "clinic" : "clinics"}`}
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * FilterGroup — a titled section within the rail, divided by a top hairline.
 * `action` renders a trailing affordance (e.g. a "Show all 12" link).
 */
export interface FilterGroupProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function FilterGroup({
  title,
  children,
  action,
  className,
}: FilterGroupProps) {
  return (
    <section
      className={cn(
        "border-t border-slate-100 py-3.5 first:border-t-0 first:pt-0",
        className,
      )}
    >
      <h3 className="mb-2.5 text-[13px] font-semibold text-slate-700">
        {title}
      </h3>
      {children}
      {action ? <div className="mt-1">{action}</div> : null}
    </section>
  );
}

/**
 * FilterCheckbox — a labelled checkbox row with an optional facet count
 * (Directory mockup). Wraps a native checkbox in a `<label>` (no `id` needed)
 * so it can be safely duplicated across the desktop/mobile rail surfaces.
 */
export interface FilterCheckboxProps extends Omit<
  React.ComponentProps<"input">,
  "type" | "size"
> {
  label: React.ReactNode;
  /** Facet count shown right-aligned. */
  count?: number;
}

export const FilterCheckbox = React.forwardRef<
  HTMLInputElement,
  FilterCheckboxProps
>(({ label, count, className, ...props }, ref) => (
  <label
    className={cn(
      "flex cursor-pointer items-center gap-2.5 py-1 text-[13.5px] text-text-secondary",
      className,
    )}
  >
    <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
    <span
      aria-hidden="true"
      className="peer-focus-visible:ring-ring/40 flex size-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-border-strong transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-checked:[&>svg]:opacity-100"
    >
      <Check
        className="size-3 text-white opacity-0 transition-opacity"
        strokeWidth={3}
        aria-hidden="true"
      />
    </span>
    <span className="peer-checked:text-text-primary">{label}</span>
    {count != null ? (
      <span className="ml-auto text-text-muted">{count}</span>
    ) : null}
  </label>
));
FilterCheckbox.displayName = "FilterCheckbox";
