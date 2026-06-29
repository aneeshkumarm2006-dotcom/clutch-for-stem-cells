"use client";

/**
 * SearchTypeahead — header search with live suggestions (PRD §6.6). Debounced
 * fetch to `/api/search/suggest` for clinics/treatments/conditions; Enter (or the
 * search icon) submits to `/search`, and picking a suggestion jumps straight to
 * its page. Keyboard accessible (combobox/listbox semantics).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, Activity, Stethoscope } from "lucide-react";

import { cn } from "@/lib/utils";

interface Suggestion {
  type: "clinic" | "treatment" | "condition";
  label: string;
  slug: string;
}

const HREF: Record<Suggestion["type"], (slug: string) => string> = {
  clinic: (s) => `/clinic/${s}`,
  treatment: (s) => `/treatments/${s}`,
  condition: (s) => `/conditions/${s}`,
};

const ICON: Record<Suggestion["type"], typeof Search> = {
  clinic: Building2,
  treatment: Activity,
  condition: Stethoscope,
};

const TYPE_LABEL: Record<Suggestion["type"], string> = {
  clinic: "Clinic",
  treatment: "Treatment",
  condition: "Condition",
};

export function SearchTypeahead({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
        setActive(-1);
      } catch {
        /* aborted / offline */
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (s: Suggestion) => {
    setOpen(false);
    setQuery("");
    router.push(HREF[s.type](s.slug));
  };

  const submit = () => {
    if (!query.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(suggestions.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && suggestions[active]) go(suggestions[active]);
      else submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="header-search-listbox"
          aria-autocomplete="list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search clinics, treatments…"
          aria-label="Search clinics, treatments and conditions"
          className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary transition-colors placeholder:text-text-muted hover:border-border-strong focus-visible:border-primary focus-visible:outline-none"
        />
      </div>

      {open && suggestions.length ? (
        <ul
          id="header-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {suggestions.map((s, i) => {
            const Icon = ICON[s.type];
            return (
              <li key={`${s.type}-${s.slug}`} role="option" aria-selected={active === i}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(s)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                    active === i ? "bg-surface-alt" : "",
                  )}
                >
                  <Icon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <span className="flex-1 truncate text-text-primary">{s.label}</span>
                  <span className="text-[11px] text-text-muted">{TYPE_LABEL[s.type]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
