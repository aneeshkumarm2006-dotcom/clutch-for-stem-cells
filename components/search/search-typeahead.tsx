"use client";

/**
 * SearchTypeahead — header search with live suggestions (PRD §6.6).
 *
 * Debounced lookups against `/api/search/suggest` across clinics, treatments,
 * conditions, and destinations. Picking a suggestion jumps straight to its
 * page; Enter on free text runs a full search. Empty and focused, it offers the
 * visitor's recent searches, which is the fastest path back to a clinic they
 * were comparing yesterday.
 *
 * Combobox/listbox semantics throughout, so the highlighted row is announced
 * rather than only drawn (WCAG 4.1.2).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { trackClientEvent } from "@/lib/analytics-client";
import type { Suggestion } from "@/lib/search";
import {
  SuggestionMenu,
  type MenuOption,
} from "@/components/search/suggestion-menu";
import {
  MIN_QUERY_LENGTH,
  useSuggestions,
} from "@/components/search/use-suggestions";
import { useComboboxNav } from "@/components/search/use-combobox-nav";
import {
  addRecentSearch,
  clearRecentSearches,
  useRecentSearches,
} from "@/components/search/recent-searches";

export interface SearchTypeaheadProps {
  className?: string;
  /** `panel` fills its container (mobile overlay); `inline` is the header field. */
  variant?: "inline" | "panel";
  placeholder?: string;
  autoFocus?: boolean;
  /** Bind the global Cmd/Ctrl+K focus shortcut (one field per page should). */
  shortcut?: boolean;
  /** Called after a navigation, so a container can close itself. */
  onNavigate?: () => void;
}

export function SearchTypeahead({
  className,
  variant = "inline",
  placeholder = "Search clinics, treatments…",
  autoFocus = false,
  shortcut = true,
  onNavigate,
}: SearchTypeaheadProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  // The header field and the mobile panel can both be mounted at once, so the
  // listbox ids have to be per-instance.
  const uid = React.useId();
  const listboxId = `${uid}-listbox`;
  const optionId = (index: number) => `${uid}-option-${index}`;

  const recents = useRecentSearches();
  const { suggestions, resolvedQuery, loading, ready } = useSuggestions(query, {
    limit: 8,
  });

  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_QUERY_LENGTH;
  const noMatches = searching && ready && suggestions.length === 0;

  /**
   * Everything selectable, in the order it is drawn. The menu groups these
   * visually but never reorders them, so this index is what the keyboard,
   * `aria-activedescendant`, and Enter all agree on.
   */
  const options = React.useMemo<MenuOption[]>(() => {
    if (!searching) {
      return recents.map((value) => ({ kind: "recent" as const, value }));
    }
    return [
      ...suggestions.map((suggestion) => ({
        kind: "suggestion" as const,
        suggestion,
      })),
      { kind: "search-all" as const, value: trimmed },
    ];
  }, [searching, recents, suggestions, trimmed]);

  // Declarations, not consts: `nav` and these handlers reference each other, and
  // hoisting lets them be written in the order they read.
  const nav = useComboboxNav<MenuOption>({
    options,
    onSelect: (option) => select(option),
    onSubmit: () => searchAll(query),
    onClear: () => setQuery(""),
  });

  function finish(recentTerm?: string): void {
    if (recentTerm) addRecentSearch(recentTerm);
    nav.setOpen(false);
    nav.setActive(-1);
    // The header persists across navigation, so a query left in the field would
    // sit there stale on the page it just opened. Clearing also means the next
    // focus offers recent searches, which now include this one.
    setQuery("");
    inputRef.current?.blur();
    onNavigate?.();
  }

  function goToSuggestion(s: Suggestion): void {
    trackClientEvent("search", { props: { picked: s.type } });
    finish(s.label);
    router.push(s.href);
  }

  function searchAll(term: string): void {
    const value = term.trim();
    if (!value) return;
    if (noMatches) trackClientEvent("search", { props: { zeroResult: true } });
    finish(value);
    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  function select(option: MenuOption): void {
    if (option.kind === "suggestion") goToSuggestion(option.suggestion);
    else if (option.kind === "recent") {
      setQuery(option.value);
      searchAll(option.value);
    } else searchAll(option.value);
  }

  // Cmd/Ctrl+K from anywhere, the convention people already have in their hands.
  React.useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <div ref={nav.rootRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={nav.listboxOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            nav.listboxOpen && nav.active >= 0
              ? optionId(nav.active)
              : undefined
          }
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            nav.setOpen(true);
          }}
          onFocus={() => nav.setOpen(true)}
          onKeyDown={nav.onKeyDown}
          placeholder={placeholder}
          aria-label="Search clinics, treatments, conditions and destinations"
          // `type="text"` rather than `search`: the browser's own clear widget
          // wipes the field without telling React, which left the menu showing
          // results for a query that was no longer there.
          className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-9 text-sm text-text-primary transition-colors placeholder:text-text-muted hover:border-border-strong focus-visible:border-primary focus-visible:outline-none"
        />

        <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
          {loading ? (
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin text-text-muted"
            />
          ) : query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                nav.setActive(-1);
                inputRef.current?.focus();
              }}
              className="rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Announced, not drawn: screen readers get the result count too. */}
      <p aria-live="polite" className="sr-only">
        {searching && ready
          ? suggestions.length === 0
            ? "No suggestions"
            : `${suggestions.length} suggestions`
          : ""}
      </p>

      {nav.listboxOpen ? (
        <SuggestionMenu
          id={listboxId}
          options={options}
          activeIndex={nav.active}
          optionId={optionId}
          onSelect={select}
          onHover={(index) => {
            nav.setActive(index);
            // Warm the route while the pointer is still travelling, so the
            // click feels instant.
            const option = options[index];
            if (option?.kind === "suggestion")
              router.prefetch(option.suggestion.href);
          }}
          query={resolvedQuery}
          loading={loading}
          className={
            variant === "panel"
              ? "left-0 right-0 top-[calc(100%+6px)]"
              : "right-0 top-[calc(100%+6px)] w-[min(22rem,calc(100vw-2rem))]"
          }
          header={
            noMatches ? (
              <li
                role="presentation"
                className="px-3 py-2 text-sm text-text-secondary"
              >
                No matches for “{trimmed}”. Try a treatment, condition, or city.
              </li>
            ) : !searching && recents.length ? (
              <li role="presentation" className="flex justify-end px-3 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches();
                    inputRef.current?.focus();
                  }}
                  className="text-[11px] font-medium text-text-muted transition-colors hover:text-text-primary"
                >
                  Clear
                </button>
              </li>
            ) : null
          }
        />
      ) : null}
    </div>
  );
}
