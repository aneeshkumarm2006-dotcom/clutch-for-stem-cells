import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Scoped Q&A rendered as a no-JS native `<details>` accordion — server-rendered,
 * fully crawlable, and paired at the page level with `faqPageJsonLd` for AEO.
 * The page owns the JSON-LD; this is presentation only. Renders nothing when
 * there are no items.
 */
export function FaqSection({
  items,
  heading = "Frequently asked questions",
  className,
}: {
  items: FaqItem[];
  heading?: string;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <section className={cn("", className)}>
      <h2 className="font-display text-xl font-semibold text-text-primary">
        {heading}
      </h2>
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {items.map((item, i) => (
          <details key={`${item.question}-${i}`} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[14.5px] font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="px-4 pb-4 text-[14px] leading-relaxed text-text-secondary">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
