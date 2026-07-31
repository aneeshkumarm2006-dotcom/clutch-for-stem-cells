"use client";

/**
 * MobileSearch — the small-screen half of the header search.
 *
 * The header field is `lg`-only (there is no room for it beside the logo and
 * the menu button), which left phone visitors with no search at all: they had
 * to open the menu and browse a directory instead. This adds an icon button
 * that drops a full-width search panel under the header, with the same
 * typeahead the desktop field uses.
 */
import * as React from "react";
import { usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchTypeahead } from "@/components/search/search-typeahead";

export function MobileSearch({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Navigating from a suggestion should leave the panel behind.
  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // The field handles Escape first and marks it handled while its menu is
      // open, so the first press dismisses the suggestions and the next one
      // closes the panel.
      if (e.key === "Escape" && !e.defaultPrevented) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className={className}
        aria-label={open ? "Close search" : "Search"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <Search className="size-5" />}
      </Button>

      {open ? (
        <div
          className={cn(
            "absolute left-0 right-0 top-full border-b border-border bg-surface p-3 shadow-md",
            className,
          )}
        >
          <SearchTypeahead
            variant="panel"
            autoFocus
            // The desktop field already owns Cmd+K; two bindings would fight.
            shortcut={false}
            onNavigate={() => setOpen(false)}
          />
        </div>
      ) : null}
    </>
  );
}
