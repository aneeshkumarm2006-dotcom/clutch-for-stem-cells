import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Admin DataTable primitives (Design §10.13). A card-wrapped table: header row
 * `surface-alt`, `body-sm`, 1px `border` row dividers, hover `surface-alt`.
 * Composed per-module (selection, master-detail, bulk actions differ) rather
 * than a single generic table.
 */

export const TableCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "overflow-hidden rounded-xl border border-border bg-surface",
      className,
    )}
    {...props}
  />
));
TableCard.displayName = "TableCard";

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-left text-[13.5px]", className)}
        {...props}
      />
    </div>
  );
}

/** Header row wrapper — pass `<Th>` cells as children. */
export function THead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <thead>
      <tr className={cn("border-b border-border bg-surface-alt", className)}>
        {children}
      </tr>
    </thead>
  );
}

export function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3.5 py-3 text-left text-[12.5px] font-semibold text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}

export const Tr = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    selected?: boolean;
    interactive?: boolean;
  }
>(({ className, selected, interactive, ...props }, ref) => (
  <tr
    ref={ref}
    data-selected={selected ? "" : undefined}
    className={cn(
      "border-b border-slate-100 last:border-0",
      selected ? "bg-background" : "hover:bg-surface-alt",
      interactive && "cursor-pointer",
      className,
    )}
    {...props}
  />
));
Tr.displayName = "Tr";

export function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-3.5 py-3 align-middle text-text-primary", className)}
      {...props}
    />
  );
}

/** Footer strip (e.g. "Showing 1–20 of 312" + pagination). */
export function TableFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[13px] text-text-muted",
        className,
      )}
      {...props}
    />
  );
}
