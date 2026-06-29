"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster (Sonner) — Design §10.12. White card, shadow-md, status accent.
 * Mount once in the root layout; call `toast()` from anywhere.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface group-[.toaster]:text-text-primary group-[.toaster]:border-border group-[.toaster]:rounded-lg group-[.toaster]:shadow-md",
          description: "group-[.toast]:text-text-secondary",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-surface-alt group-[.toast]:text-text-secondary",
          success:
            "group-[.toaster]:[--toast-border:theme(colors.success.DEFAULT)]",
          error:
            "group-[.toaster]:[--toast-border:theme(colors.danger.DEFAULT)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
