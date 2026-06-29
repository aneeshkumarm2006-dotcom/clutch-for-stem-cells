"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * StarRatingInput — an accessible 1–5 star picker (radio-group semantics) for the
 * review form (Stage 5.5). Keyboard- and pointer-operable; mirrors the display
 * RatingStars colors (filled `#F2A900`, empty `neutral-300`).
 */
export interface StarRatingInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  size?: number;
}

export function StarRatingInput({
  label,
  value,
  onChange,
  size = 24,
}: StarRatingInputProps) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13.5px] text-text-secondary">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                n <= shown
                  ? "fill-star text-star"
                  : "fill-slate-300 text-slate-300",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
