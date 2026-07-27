import { Skeleton, ClinicListSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container py-8 md:py-10">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <Skeleton className="hidden h-[600px] w-[280px] shrink-0 rounded-xl lg:block" />
        <div className="flex-1">
          <ClinicListSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}
