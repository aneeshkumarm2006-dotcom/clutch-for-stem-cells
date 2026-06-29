import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — Design §10.1. Variants: Primary / Secondary / Ghost / Destructive /
 * Link. Heights: sm 32 / md 40 / lg 48, radius-md. One primary per view region.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md font-sans text-sm font-semibold transition-colors duration-150 focus-visible:outline-none disabled:pointer-events-none active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover disabled:bg-azure-300 disabled:active:scale-100",
        secondary:
          "border border-border bg-surface text-text-primary hover:bg-surface-alt hover:border-border-strong disabled:text-text-muted disabled:border-border disabled:active:scale-100",
        ghost:
          "text-text-link hover:bg-azure-50 active:bg-azure-100 disabled:text-text-muted disabled:active:scale-100",
        destructive:
          "bg-danger text-white hover:brightness-95 disabled:opacity-45 disabled:active:scale-100",
        link: "text-text-link underline-offset-4 hover:underline active:scale-100 disabled:text-text-muted",
      },
      size: {
        sm: "h-8 px-3.5 text-[13px]",
        md: "h-10 px-[18px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
