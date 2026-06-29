import * as React from "react";

import { cn } from "@/lib/utils";

/** Textarea — Design §10.2. Same field treatment as Input. */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[88px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors",
        "placeholder:text-text-muted",
        "hover:border-border-strong",
        "focus-visible:border-primary focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
