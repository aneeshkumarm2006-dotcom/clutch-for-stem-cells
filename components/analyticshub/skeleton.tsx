import { cn } from "@/lib/utils";

/** Skeleton loaders — the app should look intentional with zero data. */
export function Bar({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-surface-alt", className)} />
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <Bar className="h-3 w-20" />
      <Bar className="mt-3 h-7 w-24" />
      <Bar className="mt-2 h-3 w-16" />
    </div>
  );
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <KpiSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <Bar className="h-4 w-40" />
      <div
        className="mt-4 w-full animate-pulse rounded bg-surface-alt"
        style={{ height }}
      />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <Bar className="h-4 w-32" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Bar key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
