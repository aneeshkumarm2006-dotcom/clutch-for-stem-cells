"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useShortlist } from "@/lib/hooks/use-shortlist";

/**
 * SaveButton — "Save to shortlist" (PRD §6.2/§6.3/§7). Toggles a clinic in the
 * shortlist (guest localStorage → synced on login, see `useShortlist`). Two
 * shapes: a full labelled button (profile/header) and a compact icon button
 * (overlaid on a clinic card).
 */
export interface SaveButtonProps {
  slug: string;
  name?: string;
  variant?: "button" | "icon";
  className?: string;
}

export function SaveButton({
  slug,
  name,
  variant = "button",
  className,
}: SaveButtonProps) {
  const { isSaved, toggle, ready } = useShortlist();
  const saved = isSaved(slug);

  const onToggle = (e: React.MouseEvent) => {
    // On a card the whole article is a link — keep the toggle local.
    e.preventDefault();
    e.stopPropagation();
    toggle(slug);
    toast(
      saved
        ? `Removed${name ? ` ${name}` : ""} from your shortlist`
        : `Saved${name ? ` ${name}` : ""} to your shortlist`,
    );
  };

  const label = saved ? "Saved" : "Save to shortlist";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${name ?? "clinic"} from shortlist` : `Save ${name ?? "clinic"} to shortlist`}
        title={label}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-md border bg-surface/90 backdrop-blur transition-colors focus-visible:outline-none",
          saved
            ? "border-azure-300 text-primary"
            : "border-border text-text-muted hover:border-border-strong hover:text-text-secondary",
          !ready && "opacity-0",
          className,
        )}
      >
        <Heart
          className={cn("size-4", saved && "fill-current")}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "secondary"}
      onClick={onToggle}
      aria-pressed={saved}
      className={cn(saved && "border-azure-300 text-primary", className)}
    >
      <Heart
        className={cn("size-[18px]", saved && "fill-current")}
        aria-hidden="true"
      />
      {label}
    </Button>
  );
}
