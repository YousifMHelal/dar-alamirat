import { KpiSkeleton, TableSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function InventoryLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3.5 w-80" />
        </div>
      </div>

      <KpiSkeleton count={4} />

      <div className="border-border flex gap-1 border-b pb-0">
        {["Stock matrix", "Transfers", "Purchase orders"].map((l) => (
          <Skeleton key={l} className="h-10 w-32 rounded-t-lg" />
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Skeleton className="h-10 flex-1 min-w-48 max-w-xs rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <TableSkeleton cols={6} rows={8} />
    </div>
  );
}
