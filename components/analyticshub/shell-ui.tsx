"use client";

import type { CSSProperties, ReactNode } from "react";

import type { ProjectConfig } from "@/lib/analyticshub/types";
import { cn } from "@/lib/utils";

/** Re-theme a subtree to the owner's project colors by overriding CSS vars. */
export function brandStyle(
  project?: Pick<ProjectConfig, "primary" | "accent">,
): CSSProperties {
  return project
    ? ({ "--primary": project.primary, "--tint": project.accent } as CSSProperties)
    : {};
}

/** Shared form/button classes so every hub surface looks like one system. */
export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";
export const labelClass = "block text-sm font-medium text-text-primary";
export const cardClass =
  "rounded-2xl border border-border bg-surface p-6 shadow-card";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger-bg disabled:opacity-50";

export function BrandMark({
  name,
  size = "md",
}: {
  name: string;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "grid place-items-center rounded-xl bg-primary font-display font-bold text-primary-foreground",
          size === "lg" ? "h-11 w-11 text-lg" : "h-9 w-9 text-base",
        )}
      >
        {(name || "A").slice(0, 1).toUpperCase()}
      </div>
      <div>
        <div className="font-display font-semibold leading-tight text-text-primary">
          {name || "Analytics"}
        </div>
        <div className="text-[11px] text-text-muted">Analytics</div>
      </div>
    </div>
  );
}

/** Full-viewport centered container for login / wizard / config-error. */
export function CenteredShell({
  project,
  wide,
  children,
}: {
  project?: ProjectConfig;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="grid min-h-screen place-items-center bg-background px-4 py-10"
      style={brandStyle(project)}
    >
      <div className={cn("w-full", wide ? "max-w-2xl" : "max-w-sm")}>
        <div className="mb-6 flex justify-center">
          <BrandMark name={project?.name ?? "Analytics"} size="lg" />
        </div>
        {children}
      </div>
    </div>
  );
}
