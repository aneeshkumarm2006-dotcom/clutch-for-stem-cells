import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-8">
          <div className="flex items-start gap-4">
            <Skeleton className="size-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
      </div>
      <div className="container grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Skeleton className="aspect-[16/7] w-full rounded-xl" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <Skeleton className="hidden h-64 rounded-xl lg:block" />
      </div>
    </>
  );
}
