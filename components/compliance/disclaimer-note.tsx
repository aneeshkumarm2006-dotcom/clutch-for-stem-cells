import * as React from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * DisclaimerNote — the persistent medical disclaimer surfaced inline on profiles,
 * reviews, case studies, and the matching wizard (Compliance §8.1 / PRD §14).
 * Informational tone only; never implies a guaranteed outcome.
 */
const VARIANTS = {
  medical:
    "Information only — not medical advice or an endorsement. Always consult a licensed physician. Individual results vary and no outcome is guaranteed.",
  results:
    "Individual results vary and are not typical or guaranteed. Case studies and testimonials reflect one person's experience.",
  pricing:
    "Pricing is indicative and set by each clinic. Confirm the final cost directly before treatment.",
} as const;

export type DisclaimerVariant = keyof typeof VARIANTS;

export function DisclaimerNote({
  variant = "medical",
  children,
  className,
}: {
  variant?: DisclaimerVariant;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-md bg-surface-alt px-3.5 py-2.5 text-[12.5px] leading-relaxed text-text-secondary",
        className,
      )}
    >
      <Info
        className="mt-0.5 size-4 shrink-0 text-text-muted"
        aria-hidden="true"
      />
      <span>{children ?? VARIANTS[variant]}</span>
    </p>
  );
}
