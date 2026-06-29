import * as React from "react";

import { cn } from "@/lib/utils";

/** Input — Design §10.2. Height 40, radius-md, focus → azure-600 + ring. */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors",
          "placeholder:text-text-muted",
          "hover:border-border-strong",
          "focus-visible:border-primary focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "aria-[invalid=true]:border-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
