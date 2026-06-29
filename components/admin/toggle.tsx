"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Toggle switch (Admin taxonomy/settings mockups). Accessible `role="switch"`
 * button: 38×22 track, azure when on, slate when off.
 */
export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
  className?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  label,
  id,
  className,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-[38px] flex-none items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-border-strong",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-[18px] rounded-full bg-white shadow-sm transition-all",
          checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}
