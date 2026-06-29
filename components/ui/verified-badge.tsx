import * as React from "react";
import { BadgeCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VerificationBadge } from "@/lib/enums";

/**
 * VerifiedBadge — Design §10.5. Convenience over `Badge` for a clinic's
 * verification state: `verified` → tint + "Verified"; `premier` → solid azure +
 * "Premier verified". Both lead with `BadgeCheck`.
 */
export interface VerifiedBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  badge?: VerificationBadge;
  /** Override the label (defaults to "Verified" / "Premier verified"). */
  label?: string;
}

const LABELS: Record<VerificationBadge, string> = {
  verified: "Verified",
  premier: "Premier verified",
};

export function VerifiedBadge({
  badge = "verified",
  label,
  className,
  ...props
}: VerifiedBadgeProps) {
  return (
    <Badge
      variant={badge === "premier" ? "premier" : "verified"}
      className={cn("whitespace-nowrap", className)}
      {...props}
    >
      <BadgeCheck aria-hidden="true" />
      {label ?? LABELS[badge]}
    </Badge>
  );
}

/**
 * FeaturedBadge — Design §10.5. Warning-tinted "Featured" pill for paid
 * placement (Compliance §8.3: paid placement must be clearly labelled).
 */
export function FeaturedBadge({
  label = "Featured",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { label?: string }) {
  return (
    <Badge variant="featured" className={className} {...props}>
      {label}
    </Badge>
  );
}
