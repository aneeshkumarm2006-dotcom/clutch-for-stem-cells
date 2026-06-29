import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Skeleton — Design §10 (loading states). A soft pulsing placeholder block. The
 * pulse is disabled under `prefers-reduced-motion` by the global rule in
 * `globals.css`. Mark loading regions with `aria-busy` / `aria-hidden`.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-100", className)}
      {...props}
    />
  );
}

/** Loading placeholder shaped like a `ClinicCard` (Design §10.4). */
export function ClinicCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5 shadow-card",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex gap-4">
        <Skeleton className="size-[46px] shrink-0 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-20 rounded-sm" />
      </div>
      <Skeleton className="mt-4 h-3.5 w-32" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-24 rounded-sm" />
        <Skeleton className="h-6 w-20 rounded-sm" />
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-border pt-3.5">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/** A vertical stack of `ClinicCardSkeleton`s for a loading results list. */
export function ClinicListSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <ClinicCardSkeleton key={i} />
      ))}
    </div>
  );
}
