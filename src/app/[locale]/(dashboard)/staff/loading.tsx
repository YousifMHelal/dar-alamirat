import { TableSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function StaffLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3.5 w-72" />
        </div>
      </div>

      <Skeleton className="h-10 w-36 rounded-lg" />

      <TableSkeleton cols={4} rows={8} />
    </div>
  );
}
