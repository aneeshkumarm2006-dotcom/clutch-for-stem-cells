"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * ProfileSubnav — Design §5.3 / PRD §6.3. A sticky in-page nav under the clinic
 * header. Smooth-scrolls to each section and highlights the one in view via an
 * IntersectionObserver. Only renders sections present on the page.
 */
export interface SubnavItem {
  id: string;
  label: string;
}

export function ProfileSubnav({ items }: { items: SubnavItem[] }) {
  const [active, setActive] = React.useState(items[0]?.id);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="On this page"
      className="sticky top-[68px] z-30 -mx-4 border-b border-border bg-surface/95 px-4 backdrop-blur"
    >
      <ul className="flex gap-6 overflow-x-auto">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "true" : undefined}
              className={cn(
                "inline-flex whitespace-nowrap border-b-2 px-0.5 py-3 text-[13.5px] font-semibold transition-colors",
                active === item.id
                  ? "border-primary text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
