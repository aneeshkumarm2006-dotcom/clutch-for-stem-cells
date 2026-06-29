import * as React from "react";
import { Search, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * SearchBar — Design §10.3. The signature hero/header search.
 *
 * Implemented as a native `GET` `<form>` so it works without JS and is fully
 * SSR-friendly: submitting navigates to `action` (default `/clinics`) with the
 * field values as query params. Field names default to the directory's params
 * (`q`, `country` — see `lib/search.ts`).
 *
 * - **hero** (default): white surface, segmented condition + location fields
 *   divided by a hairline, trailing primary Search button. Stacks vertically
 *   below `md` (fields divided by a top border, button full-width).
 * - **compact**: a single bordered field (height 40) for the navbar.
 */
export interface SearchBarProps {
  variant?: "hero" | "compact";
  action?: string;
  queryName?: string;
  locationName?: string;
  defaultQuery?: string;
  defaultLocation?: string;
  queryPlaceholder?: string;
  locationPlaceholder?: string;
  buttonLabel?: string;
  /** Hero only: hide the location field (single full-width query field). */
  showLocation?: boolean;
  className?: string;
  /** Extra hidden inputs to preserve (e.g. a fixed taxonomy filter). */
  hiddenParams?: Record<string, string>;
}

export function SearchBar({
  variant = "hero",
  action = "/clinics",
  queryName = "q",
  locationName = "country",
  defaultQuery,
  defaultLocation,
  queryPlaceholder,
  locationPlaceholder = "Any location",
  buttonLabel = "Search",
  showLocation = true,
  className,
  hiddenParams,
}: SearchBarProps) {
  const hidden = hiddenParams
    ? Object.entries(hiddenParams).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))
    : null;

  if (variant === "compact") {
    return (
      <form
        role="search"
        method="get"
        action={action}
        className={cn("relative", className)}
      >
        {hidden}
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
        />
        <input
          type="search"
          name={queryName}
          defaultValue={defaultQuery}
          placeholder={queryPlaceholder ?? "Search clinics"}
          aria-label={queryPlaceholder ?? "Search clinics"}
          className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary transition-colors placeholder:text-text-muted hover:border-border-strong focus-visible:border-primary focus-visible:outline-none"
        />
      </form>
    );
  }

  return (
    <form
      role="search"
      method="get"
      action={action}
      className={cn("w-full max-w-[620px]", className)}
    >
      {hidden}
      <div className="flex flex-col rounded-[18px] border border-border bg-surface p-2 shadow-elevated md:flex-row md:items-stretch md:rounded-lg">
        <label className="flex flex-[1.3] items-center gap-2.5 rounded-md px-3.5 py-2.5">
          <Search
            aria-hidden="true"
            className="size-[17px] shrink-0 text-primary"
          />
          <input
            type="search"
            name={queryName}
            defaultValue={defaultQuery}
            placeholder={queryPlaceholder ?? "Condition, treatment or clinic"}
            aria-label={queryPlaceholder ?? "Condition, treatment or clinic"}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </label>

        {showLocation ? (
          <>
            <div
              aria-hidden="true"
              className="border-t border-border md:my-1.5 md:w-px md:self-stretch md:border-l md:border-t-0"
            />
            <label className="flex flex-1 items-center gap-2.5 rounded-md px-3.5 py-2.5">
              <MapPin
                aria-hidden="true"
                className="size-[17px] shrink-0 text-primary"
              />
              <input
                type="text"
                name={locationName}
                defaultValue={defaultLocation}
                placeholder={locationPlaceholder}
                aria-label={locationPlaceholder}
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </label>
          </>
        ) : null}

        <Button
          type="submit"
          className="mt-2 w-full md:mt-0 md:h-auto md:w-auto md:self-stretch md:px-5"
        >
          <Search className="size-[18px]" aria-hidden="true" />
          {buttonLabel}
        </Button>
      </div>
    </form>
  );
}
