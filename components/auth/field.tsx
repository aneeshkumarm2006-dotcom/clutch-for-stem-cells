import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Labeled input for the auth forms — Stage 2.5. A light wrapper over `Input`
 * (the full form primitives land in Stage 4.2). Forwards its ref so it drops
 * straight into `react-hook-form`'s `register()`.
 */
export interface FieldProps extends React.ComponentProps<"input"> {
  label: string;
  error?: string;
  /** Optional node aligned to the right of the label (e.g. a "Forgot?" link). */
  labelAccessory?: React.ReactNode;
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, labelAccessory, id, name, className, type, ...props }, ref) => {
    const fieldId = id ?? name;
    const errorId = error && fieldId ? `${fieldId}-error` : undefined;
    const isPassword = type === "password";
    const [showPw, setShowPw] = React.useState(false);

    return (
      <div className="mb-3.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label
            htmlFor={fieldId}
            className="text-[13px] font-medium text-text-secondary"
          >
            {label}
          </label>
          {labelAccessory}
        </div>
        <div className={cn(isPassword && "relative")}>
          <Input
            id={fieldId}
            name={name}
            ref={ref}
            type={isPassword ? (showPw ? "text" : "password") : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={cn("h-[42px]", isPassword && "pr-10", className)}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-secondary focus:outline-none"
            >
              {showPw ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          ) : null}
        </div>
        {error ? (
          <p id={errorId} className="mt-1 text-[12.5px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Field.displayName = "Field";
