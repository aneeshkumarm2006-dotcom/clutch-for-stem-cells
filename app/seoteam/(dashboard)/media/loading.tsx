import { Skeleton } from "@/components/ui/skeleton";

/** Route-level loading UI for `/seoteam/media` (shown while the server list loads). */
export default function MediaLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6" aria-busy="true">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <Skeleton className="h-7 w-12" />
            <Skeleton className="mt-2 h-3.5 w-20" />
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-20 rounded-md" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            <Skeleton className="aspect-square rounded-none" />
            <div className="space-y-1.5 p-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
