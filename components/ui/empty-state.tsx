import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * EmptyState — Design §10.10 / §11. A single Lucide icon (24px, `neutral-400`)
 * in a `tint` circle + headline + one-line body + an optional primary action.
 * Voice §13: name the space and invite action — invitations, not apologies.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Primary action node (e.g. a `Button`). */
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-tint">
        <Icon className="size-6 text-text-muted" aria-hidden="true" />
      </span>
      <h3 className="font-display text-[17px] font-semibold text-text-primary">
        {title}
      </h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
