import { KpiSkeleton, TableSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function SeoLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-3.5 w-72" />
          </div>
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <KpiSkeleton count={4} />

      <div className="border-border flex gap-1 border-b">
        <Skeleton className="h-10 w-36 rounded-t-lg" />
        <Skeleton className="h-10 w-28 rounded-t-lg" />
      </div>

      <TableSkeleton cols={3} rows={8} />
    </div>
  );
}
