import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Answer-first TL;DR block — a 40–60 word direct answer placed at the very top
 * of a combination page, mirroring the H1 question. This is the passage answer
 * engines quote, so it's the highest-priority string for the cure/guarantee
 * scanner and must stay cautious (no efficacy claims). Renders nothing when
 * empty.
 */
export function AnswerBlock({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div
      className={cn(
        "bg-tint/40 rounded-xl border-l-4 border-primary px-5 py-4",
        className,
      )}
    >
      <p className="text-[15.5px] leading-relaxed text-text-primary">
        {children}
      </p>
    </div>
  );
}
