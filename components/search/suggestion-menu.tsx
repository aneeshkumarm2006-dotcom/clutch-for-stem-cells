"use client";

/**
 * SuggestionMenu — the dropdown half of every typeahead on the site (the data
 * half is `use-suggestions.ts`).
 *
 * Renders a flat list of already-ordered options and groups them visually by
 * kind. Grouping is presentational only: the parent owns the option array, so
 * the index it tracks for `aria-activedescendant` and Enter always matches what
 * the visitor sees.
 */
import * as React from "react";
import {
  Activity,
  Building2,
  Clock,
  MapPin,
  Search,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import type { Suggestion, SuggestionType } from "@/lib/search";
import { foldForMatch } from "@/components/search/use-suggestions";

export type MenuOption =
  | { kind: "suggestion"; suggestion: Suggestion }
  | { kind: "recent"; value: string }
  /** The "search everything for what I typed" escape hatch, pinned last. */
  | { kind: "search-all"; value: string };

const ICON: Record<SuggestionType, LucideIcon> = {
  clinic: Building2,
  treatment: Activity,
  condition: Stethoscope,
  location: MapPin,
};

const GROUP_LABEL: Record<SuggestionType, string> = {
  clinic: "Clinics",
  treatment: "Treatments",
  condition: "Conditions",
  location: "Destinations",
};

/**
 * Split a label on the matched term so it can be emphasised. Accent- and
 * case-insensitive, matching how the server found the row in the first place,
 * so "cancun" still highlights inside "Cancún".
 *
 * Offsets are read off the folded string and applied to the original, which
 * holds for the precomposed text we store. Already-decomposed text would shift
 * the highlight by a character; it stays a cosmetic slip, never a wrong row.
 */
function splitOnMatch(
  label: string,
  query: string,
): { before: string; match: string; after: string } {
  const q = query.trim();
  if (!q) return { before: label, match: "", after: "" };
  const at = foldForMatch(label).indexOf(foldForMatch(q));
  if (at < 0) return { before: label, match: "", after: "" };
  return {
    before: label.slice(0, at),
    match: label.slice(at, at + q.length),
    after: label.slice(at + q.length),
  };
}

function Highlight({ label, query }: { label: string; query: string }) {
  const { before, match, after } = splitOnMatch(label, query);
  if (!match) return <>{label}</>;
  return (
    <>
      {before}
      <mark className="bg-transparent font-semibold text-text-primary">
        {match}
      </mark>
      {after}
    </>
  );
}

/** "12 clinics" / "1 clinic", or nothing when a term has no listings yet. */
function countLabel(count?: number): string | null {
  if (!count) return null;
  return `${formatCount(count)} ${count === 1 ? "clinic" : "clinics"}`;
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <li
      role="presentation"
      className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
    >
      {children}
    </li>
  );
}

export interface SuggestionMenuProps {
  id: string;
  options: MenuOption[];
  /** Index into `options`, or -1 when nothing is highlighted. */
  activeIndex: number;
  optionId: (index: number) => string;
  onSelect: (option: MenuOption, index: number) => void;
  onHover: (index: number) => void;
  /** The term the options were resolved for, used to emphasise the match. */
  query: string;
  loading?: boolean;
  /** Shown above the options, e.g. a "Clear" action for recent searches. */
  header?: React.ReactNode;
  className?: string;
}

export function SuggestionMenu({
  id,
  options,
  activeIndex,
  optionId,
  onSelect,
  onHover,
  query,
  loading = false,
  header,
  className,
}: SuggestionMenuProps) {
  let lastType: SuggestionType | null = null;
  let seenRecent = false;

  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Search suggestions"
      aria-busy={loading || undefined}
      className={cn(
        "absolute z-50 max-h-[min(70vh,26rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface py-1 shadow-lg",
        className,
      )}
    >
      {header}

      {options.map((option, index) => {
        const isActive = index === activeIndex;
        const rows: React.ReactNode[] = [];

        if (option.kind === "recent" && !seenRecent) {
          seenRecent = true;
          rows.push(
            <GroupHeading key="recent-heading">Recent searches</GroupHeading>,
          );
        }
        if (
          option.kind === "suggestion" &&
          option.suggestion.type !== lastType
        ) {
          lastType = option.suggestion.type;
          rows.push(
            <GroupHeading key={`heading-${lastType}`}>
              {GROUP_LABEL[lastType]}
            </GroupHeading>,
          );
        }

        const shared = {
          id: optionId(index),
          role: "option" as const,
          "aria-selected": isActive,
        };
        const buttonClass = cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
          isActive && "bg-surface-alt",
        );

        if (option.kind === "search-all") {
          rows.push(
            <li
              key="search-all"
              {...shared}
              className="mt-1 border-t border-border pt-1"
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => onHover(index)}
                onClick={() => onSelect(option, index)}
                className={buttonClass}
              >
                <Search
                  aria-hidden="true"
                  className="size-4 shrink-0 text-text-muted"
                />
                <span className="truncate text-sm text-text-secondary">
                  Search everything for{" "}
                  <span className="font-semibold text-text-primary">
                    {option.value}
                  </span>
                </span>
              </button>
            </li>,
          );
          return rows;
        }

        if (option.kind === "recent") {
          rows.push(
            <li key={`recent-${option.value}`} {...shared}>
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => onHover(index)}
                onClick={() => onSelect(option, index)}
                className={buttonClass}
              >
                <Clock
                  aria-hidden="true"
                  className="size-4 shrink-0 text-text-muted"
                />
                <span className="flex-1 truncate text-sm text-text-primary">
                  {option.value}
                </span>
              </button>
            </li>,
          );
          return rows;
        }

        const s = option.suggestion;
        const Icon = ICON[s.type];
        const count = countLabel(s.count);

        rows.push(
          <li key={`${s.type}-${s.slug}`} {...shared}>
            <button
              type="button"
              tabIndex={-1}
              onMouseEnter={() => onHover(index)}
              onClick={() => onSelect(option, index)}
              className={buttonClass}
            >
              {s.flag ? (
                <span
                  aria-hidden="true"
                  className="w-4 shrink-0 text-center text-base leading-none"
                >
                  {s.flag}
                </span>
              ) : (
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-text-muted"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-primary">
                  <Highlight label={s.label} query={query} />
                </span>
                {s.sublabel ? (
                  <span className="block truncate text-xs text-text-muted">
                    {s.sublabel}
                  </span>
                ) : null}
              </span>
              {count ? (
                <span className="shrink-0 text-[11px] text-text-muted">
                  {count}
                </span>
              ) : null}
            </button>
          </li>,
        );
        return rows;
      })}
    </ul>
  );
}
