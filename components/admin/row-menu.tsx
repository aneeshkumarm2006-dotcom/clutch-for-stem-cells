"use client";

import * as React from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";

import { cn } from "@/lib/utils";

export interface RowMenuItem {
  label: string;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  /** Open links in a new tab. */
  external?: boolean;
}

/** Lightweight kebab action menu for table rows (click-away to close). */
export function RowMenu({ items, label = "Row actions" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1 text-text-muted hover:bg-surface-alt hover:text-text-secondary"
      >
        <MoreVertical className="size-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-8 z-30 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg"
        >
          {items.map((item, i) => {
            const cls = cn(
              "block w-full px-3 py-2 text-left text-[13px] hover:bg-surface-alt",
              item.destructive ? "text-danger" : "text-text-primary",
            );
            if (item.href) {
              return (
                <Link
                  key={i}
                  href={item.href}
                  role="menuitem"
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className={cls}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={cls}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
