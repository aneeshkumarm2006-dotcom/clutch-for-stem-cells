"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Search, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { trackClientEvent } from "@/lib/analytics-client";
import type { Suggestion, SuggestionType } from "@/lib/search";
import {
  SuggestionMenu,
  type MenuOption,
} from "@/components/search/suggestion-menu";
import {
  MIN_QUERY_LENGTH,
  namesExactly,
  peekSuggestions,
  useSuggestions,
} from "@/components/search/use-suggestions";
import { useComboboxNav } from "@/components/search/use-combobox-nav";
import { addRecentSearch } from "@/components/search/recent-searches";

/**
 * SearchBar — Design §10.3. The signature hero/header search.
 *
 * Still a native `GET` `<form>`, so with JavaScript disabled it submits its
 * field values to `action` exactly as before. With JavaScript it becomes two
 * live typeaheads and resolves what was typed into real directory filters
 * before navigating (see {@link buildDestination}).
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
  /** Narrow what the main field suggests, e.g. `["clinic"]` on a review form. */
  suggestTypes?: readonly SuggestionType[];
  className?: string;
  /** Extra hidden inputs to preserve (e.g. a fixed taxonomy filter). */
  hiddenParams?: Record<string, string>;
}

/** The directory route, the only `action` whose filter contract we can build. */
const DIRECTORY_ACTION = "/clinics";
const PLACE_TYPES = ["location"] as const;
const TERM_TYPES = ["clinic", "treatment", "condition"] as const;

/**
 * How many rows a field asks for. A narrower field needs fewer, but the number
 * is part of the response cache key, so the field's fetch and the submit-time
 * lookup in `peekSuggestions` have to agree on it or the lookup always misses.
 */
const rowsFor = (types?: readonly SuggestionType[]): number =>
  types?.length === 1 ? 6 : 8;

export function SearchBar({
  variant = "hero",
  action = DIRECTORY_ACTION,
  queryName = "q",
  locationName = "country",
  defaultQuery,
  defaultLocation,
  queryPlaceholder,
  locationPlaceholder = "Any location",
  buttonLabel = "Search",
  showLocation = true,
  suggestTypes,
  className,
  hiddenParams,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(defaultQuery ?? "");
  const [place, setPlace] = React.useState(defaultLocation ?? "");
  const [pickedTerm, setPickedTerm] = React.useState<Suggestion | null>(null);
  const [pickedPlace, setPickedPlace] = React.useState<Suggestion | null>(null);
  const queryRef = React.useRef<HTMLInputElement>(null);

  const withLocation = variant === "hero" && showLocation;
  // Without a location field the main one has to cover places too, otherwise
  // "Mexico" finds nothing on the search page.
  const termTypes = suggestTypes ?? (withLocation ? TERM_TYPES : undefined);
  const termRows = rowsFor(termTypes);
  const placeRows = rowsFor(PLACE_TYPES);

  // Re-sync when the page hands down a different value (back button, or a
  // results page re-rendering for a new query).
  React.useEffect(() => setQuery(defaultQuery ?? ""), [defaultQuery]);
  React.useEffect(() => setPlace(defaultLocation ?? ""), [defaultLocation]);

  /**
   * The suggestion the typed text actually stands for. A pick counts only while
   * the text still matches it, so editing after choosing falls back to free
   * text rather than silently filtering by the old choice.
   */
  function resolveTerm(): Suggestion | null {
    if (query.trim().length < MIN_QUERY_LENGTH) return null;
    if (pickedTerm && namesExactly(query, pickedTerm.label)) return pickedTerm;
    const peeked =
      peekSuggestions(query, { types: termTypes, limit: termRows }) ?? [];
    return peeked.find((s) => namesExactly(query, s.label)) ?? null;
  }

  /**
   * Same for the place field, but it also accepts the best-ranked match rather
   * than requiring an exact one. The old form posted whatever was typed as
   * `?country=`, so a city ("Cancun") produced an empty directory page: a real
   * place, zero results, and a soft 404 for anyone who linked to it.
   */
  function resolvePlace(): Suggestion | null {
    if (place.trim().length < MIN_QUERY_LENGTH) return null;
    if (pickedPlace && namesExactly(place, pickedPlace.label))
      return pickedPlace;
    const peeked =
      peekSuggestions(place, { types: PLACE_TYPES, limit: placeRows }) ?? [];
    return (
      peeked.find((s) => namesExactly(place, s.label)) ?? peeked[0] ?? null
    );
  }

  /** Where a submit should land, given what each field resolved to. */
  function buildDestination(term: Suggestion | null): string {
    const queryText = query.trim();
    const placeText = place.trim();

    // A named clinic is the answer to its own search; no filter beats it.
    if (term?.type === "clinic") return term.href;

    // A term on its own is better served by its own page: real editorial
    // content and an indexable URL, rather than a filtered directory view that
    // `lib/seo-indexation` deliberately keeps out of the index.
    if (term && !placeText && !hiddenParams) return term.href;

    // Anything but the directory (e.g. `/search`) only understands free text.
    if (action !== DIRECTORY_ACTION) {
      const params = new URLSearchParams(hiddenParams);
      if (queryText) params.set(queryName, queryText);
      const qs = params.toString();
      return qs ? `${action}?${qs}` : action;
    }

    const resolvedPlace = withLocation ? resolvePlace() : null;
    const params = new URLSearchParams(hiddenParams);
    if (term?.filter) params.set(term.filter.key, term.filter.value);
    else if (queryText) params.set(queryName, queryText);

    if (resolvedPlace?.filter)
      params.set(resolvedPlace.filter.key, resolvedPlace.filter.value);
    else if (placeText) params.set(locationName, placeText);

    const qs = params.toString();
    return qs ? `${action}?${qs}` : action;
  }

  function submit(term: Suggestion | null = resolveTerm()): void {
    const queryText = query.trim();
    if (!queryText && !place.trim() && !hiddenParams) return;
    // Remember what was chosen, not the half-typed prefix that found it.
    addRecentSearch(term?.label ?? queryText);
    if (term) trackClientEvent("search", { props: { picked: term.type } });
    router.push(buildDestination(term));
  }

  const compact = variant === "compact";

  const queryField = (
    <SuggestField
      inputRef={queryRef}
      name={queryName}
      value={query}
      onChange={(value) => {
        setQuery(value);
        setPickedTerm(null);
      }}
      onPick={(s) => {
        setQuery(s.label);
        setPickedTerm(s);
        submit(s);
      }}
      onSubmit={() => submit()}
      types={termTypes}
      rows={termRows}
      icon={Search}
      placeholder={
        queryPlaceholder ??
        (compact ? "Search clinics" : "Condition, treatment or clinic")
      }
      variant={compact ? "bordered" : "seamless"}
      className={compact ? undefined : "flex-[1.3]"}
    />
  );

  const fields = (
    <>
      {queryField}

      {withLocation ? (
        <>
          <div
            aria-hidden="true"
            className="border-t border-border md:my-1.5 md:w-px md:self-stretch md:border-l md:border-t-0"
          />
          <SuggestField
            name={locationName}
            value={place}
            onChange={(value) => {
              setPlace(value);
              setPickedPlace(null);
            }}
            onPick={(s) => {
              setPlace(s.label);
              setPickedPlace(s);
              // Picking a place is rarely the whole search, so hand focus back
              // to the empty field instead of navigating out from under them.
              if (!query.trim()) queryRef.current?.focus();
            }}
            onSubmit={() => submit()}
            types={PLACE_TYPES}
            rows={placeRows}
            icon={MapPin}
            placeholder={locationPlaceholder}
            className="flex-1"
          />
        </>
      ) : null}
    </>
  );

  const hidden = hiddenParams
    ? Object.entries(hiddenParams).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))
    : null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  if (compact) {
    return (
      <form
        role="search"
        method="get"
        action={action}
        onSubmit={onSubmit}
        className={cn("relative", className)}
      >
        {hidden}
        {queryField}
      </form>
    );
  }

  return (
    <form
      role="search"
      method="get"
      action={action}
      onSubmit={onSubmit}
      className={cn("w-full max-w-[620px]", className)}
    >
      {hidden}
      <div className="flex flex-col rounded-[18px] border border-border bg-surface p-2 shadow-elevated md:flex-row md:items-stretch md:rounded-lg">
        {fields}
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

// ── One field of the bar ─────────────────────────────────────────────────────

interface SuggestFieldProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (suggestion: Suggestion) => void;
  onSubmit: () => void;
  types?: readonly SuggestionType[];
  /** Must match what the parent peeks with; see {@link rowsFor}. */
  rows: number;
  icon: LucideIcon;
  placeholder: string;
  /** `seamless` sits inside the hero card; `bordered` stands alone. */
  variant?: "seamless" | "bordered";
  inputRef?: React.RefObject<HTMLInputElement>;
  className?: string;
}

/**
 * A single labelled input plus its suggestion menu. Keeps its own `name`, so
 * the form still degrades to a plain `GET` submit without JavaScript.
 */
function SuggestField({
  name,
  value,
  onChange,
  onPick,
  onSubmit,
  types,
  rows,
  icon: Icon,
  placeholder,
  variant = "seamless",
  inputRef,
  className,
}: SuggestFieldProps) {
  const router = useRouter();
  const localRef = React.useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  // Generated, not passed: a page can render more than one search bar, and
  // duplicate ids would point `aria-controls` at the wrong menu.
  const uid = React.useId();
  const id = `${uid}-field`;
  const listboxId = `${uid}-listbox`;
  const optionId = (index: number) => `${uid}-option-${index}`;

  const { suggestions, resolvedQuery, loading } = useSuggestions(value, {
    types,
    limit: rows,
  });

  const options = React.useMemo<MenuOption[]>(
    () =>
      suggestions.map((suggestion) => ({
        kind: "suggestion" as const,
        suggestion,
      })),
    [suggestions],
  );

  const nav = useComboboxNav<MenuOption>({
    options,
    onSelect: (option) => {
      if (option.kind === "suggestion") onPick(option.suggestion);
    },
    onSubmit,
    onClear: () => onChange(""),
  });

  return (
    <div ref={nav.rootRef} className={cn("relative min-w-0", className)}>
      <label
        htmlFor={id}
        className={cn(
          "flex items-center gap-2.5",
          variant === "bordered"
            ? "h-10 rounded-md border border-border bg-surface px-3 transition-colors focus-within:border-primary hover:border-border-strong"
            : "rounded-md px-3.5 py-2.5",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn(
            "size-[17px] shrink-0",
            variant === "bordered" ? "text-slate-500" : "text-primary",
          )}
        />
        <input
          ref={ref}
          id={id}
          name={name}
          // `text`, not `search`: the browser's built-in clear widget empties
          // the field without notifying React, leaving a menu of results for a
          // query that is no longer on screen.
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
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            nav.setOpen(true);
          }}
          onFocus={() => nav.setOpen(true)}
          onKeyDown={nav.onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {loading ? (
          <Loader2
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin text-text-muted"
          />
        ) : null}
      </label>

      {nav.listboxOpen ? (
        <SuggestionMenu
          id={listboxId}
          options={options}
          activeIndex={nav.active}
          optionId={optionId}
          onSelect={nav.select}
          onHover={(index) => {
            nav.setActive(index);
            const option = options[index];
            if (option?.kind === "suggestion")
              router.prefetch(option.suggestion.href);
          }}
          query={resolvedQuery}
          loading={loading}
          className="left-0 top-[calc(100%+8px)] w-[min(20rem,calc(100vw-3rem))] min-w-full"
        />
      ) : null}
    </div>
  );
}
