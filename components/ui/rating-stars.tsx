import * as React from "react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { STAR_SYMBOL_ID } from "@/components/ui/icon-sprite";
import type { SubRatingKey } from "@/lib/enums";

/**
 * RatingStars — Design §10.6. Five stars, filled `#F2A900`, empty `neutral-300`,
 * with smooth fractional (half) fill via a clipped gold overlay. Always pairs
 * with a numeric value + review count and exposes a screen-reader text
 * equivalent ("4.8 out of 5, 126 reviews").
 */
export interface RatingStarsProps {
  /** 0–5; clamped. */
  value: number;
  reviewCount?: number;
  /** Star edge length in px. */
  size?: number;
  /** Show the numeric value beside the stars. */
  showValue?: boolean;
  /** "full" → "(126 reviews)"; "compact" → "(126)". */
  countStyle?: "full" | "compact";
  className?: string;
}

/** Gap between stars, in px. Was `gap-px` on the old flex row. */
const STAR_GAP = 1;

/**
 * Five stars as a single `<svg>` of `<use>` references (see
 * `components/ui/icon-sprite.tsx` for why they are not five icon components).
 *
 * `fill` and `stroke` are set on this element and inherit through each `<use>`
 * into the shared symbol, which is what still lets one row render grey and the
 * row clipped on top of it render gold.
 */
function StarRow({ size, filled }: { size: number; filled: boolean }) {
  const width = size * 5 + STAR_GAP * 4;
  return (
    <svg
      width={width}
      height={size}
      viewBox={`0 0 ${width} ${size}`}
      stroke="currentColor"
      className={cn(
        "shrink-0",
        filled ? "fill-star text-star" : "fill-slate-300 text-slate-300",
      )}
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <use
          key={i}
          href={`#${STAR_SYMBOL_ID}`}
          x={i * (size + STAR_GAP)}
          y={0}
          width={size}
          height={size}
        />
      ))}
    </svg>
  );
}

export function RatingStars({
  value,
  reviewCount,
  size = 15,
  showValue = true,
  countStyle = "full",
  className,
}: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const pct = (clamped / 5) * 100;

  const countText =
    reviewCount == null
      ? undefined
      : countStyle === "full"
        ? `(${formatCount(reviewCount)} ${reviewCount === 1 ? "review" : "reviews"})`
        : `(${formatCount(reviewCount)})`;

  const srText = `${clamped.toFixed(1)} out of 5${
    reviewCount == null
      ? ""
      : `, ${formatCount(reviewCount)} ${reviewCount === 1 ? "review" : "reviews"}`
  }`;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative inline-flex" aria-hidden="true">
        <StarRow size={size} filled={false} />
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          <StarRow size={size} filled />
        </span>
      </span>
      {showValue ? (
        <span
          aria-hidden="true"
          className="font-display text-sm font-semibold text-text-primary"
        >
          {clamped.toFixed(1)}
        </span>
      ) : null}
      {countText ? (
        <span aria-hidden="true" className="text-[13px] text-text-muted">
          {countText}
        </span>
      ) : null}
      <span className="sr-only">{srText}</span>
    </span>
  );
}

/**
 * SubRatingBar — Design §10.6. A labelled sub-rating with its value out of 5 and
 * a thin track (`tint` track, `azure-600` fill). Used in review breakdowns.
 */
export interface SubRatingBarProps {
  label: string;
  /** 0–5; clamped. */
  value: number;
  className?: string;
}

export function SubRatingBar({ label, value, className }: SubRatingBarProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const pct = (clamped / 5) * 100;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-28 shrink-0 text-[13px] text-text-secondary">
        {label}
      </span>
      <span
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-tint"
        role="img"
        aria-label={`${label}: ${clamped.toFixed(1)} out of 5`}
      >
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-7 shrink-0 text-right font-display text-[13px] font-semibold text-text-primary">
        {clamped.toFixed(1)}
      </span>
    </div>
  );
}

/** Display labels for the five sub-rating axes (PRD §5.2). */
export const SUB_RATING_LABELS: Record<SubRatingKey, string> = {
  outcome: "Outcome",
  communication: "Communication",
  facility: "Facility",
  value: "Value",
  refer: "Would refer",
};

export interface SubRatingsProps {
  /** Map of sub-rating key → 0–5 value (e.g. `Clinic.ratingBreakdown`). */
  breakdown: Partial<Record<SubRatingKey, number>>;
  className?: string;
}

/** Renders the full set of `SubRatingBar`s from a rating breakdown. */
export function SubRatings({ breakdown, className }: SubRatingsProps) {
  const keys = Object.keys(SUB_RATING_LABELS) as SubRatingKey[];
  return (
    <div className={cn("space-y-2.5", className)}>
      {keys.map((key) => (
        <SubRatingBar
          key={key}
          label={SUB_RATING_LABELS[key]}
          value={breakdown[key] ?? 0}
        />
      ))}
    </div>
  );
}
