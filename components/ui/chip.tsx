import * as React from "react";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Chip — Design §10.7.
 *
 * - **Display chip** (on cards): `azure-50` fill, `neutral-200` border,
 *   `text-secondary`, `radius-sm`.
 * - **Filter chip** (interactive): same default; **selected** = `tint` fill,
 *   `azure-700` text, `azure-300` border. Pass `onRemove` for a trailing `X`
 *   (active-filter chips) or `onClick` to make the whole chip a toggle.
 *
 * Removable chips render a `<span>` with a nested remove `<button>` (avoids
 * invalid nested buttons); a clickable, non-removable chip renders a `<button>`.
 */
const chipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border text-[12px] font-medium leading-tight transition-colors",
  {
    variants: {
      selected: {
        true: "border-azure-300 bg-tint text-azure-700",
        false: "border-border bg-azure-50 text-text-secondary",
      },
      interactive: {
        true: "cursor-pointer hover:border-border-strong",
        false: "",
      },
      size: {
        sm: "px-2 py-0.5 text-[11.5px]",
        md: "px-2.5 py-1",
      },
    },
    compoundVariants: [
      {
        interactive: true,
        selected: true,
        class: "hover:border-azure-300",
      },
    ],
    defaultVariants: { selected: false, interactive: false, size: "md" },
  },
);

export interface ChipProps
  extends
    Omit<React.HTMLAttributes<HTMLElement>, "onClick">,
    VariantProps<typeof chipVariants> {
  /** Makes the whole chip a toggle button (omit when using `onRemove`). */
  onClick?: () => void;
  /** Adds a trailing remove `X` button; renders the chip as a `<span>`. */
  onRemove?: () => void;
  /** Accessible label for the remove button (defaults to "Remove {children}"). */
  removeLabel?: string;
}

export function Chip({
  children,
  selected,
  size,
  onClick,
  onRemove,
  removeLabel,
  className,
  ...props
}: ChipProps) {
  const interactive = Boolean(onClick) && !onRemove;

  const content = (
    <>
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={
            removeLabel ??
            `Remove ${typeof children === "string" ? children : "filter"}`
          }
          className="-mr-0.5 ml-0.5 inline-flex items-center rounded-sm text-current opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none"
        >
          <X className="size-3" strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected ?? undefined}
        className={cn(
          chipVariants({ selected, interactive: true, size }),
          className,
        )}
        {...props}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={cn(
        chipVariants({ selected, interactive: false, size }),
        className,
      )}
      {...props}
    >
      {content}
    </span>
  );
}

export { chipVariants };
