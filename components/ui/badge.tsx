import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge — Design §10.5. Verified / Premier / Featured + admin status variants.
 * Radius-sm, 12px/600, icon 11–12px.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold leading-tight [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        verified: "bg-tint text-azure-700",
        premier: "bg-primary text-primary-foreground",
        featured: "bg-warning-bg text-[#8A5A00]",
        success: "bg-success-bg text-[#07623F]",
        warning: "bg-warning-bg text-[#8A5A00]",
        danger: "bg-danger-bg text-[#97231F]",
        neutral: "bg-slate-100 text-text-secondary",
        info: "bg-tint text-azure-700",
      },
    },
    defaultVariants: {
      variant: "verified",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
