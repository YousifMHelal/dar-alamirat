import { KpiSkeleton, CardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-14 flex items-center gap-3">
        <div className="bg-primary-soft size-11 rounded-xl animate-pulse motion-reduce:animate-none" />
        <div className="flex flex-col gap-1.5">
          <div className="bg-muted h-7 w-48 rounded-lg animate-pulse motion-reduce:animate-none" />
          <div className="bg-muted h-3.5 w-64 rounded animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      <div className="bg-card shadow-soft border-border h-14 rounded-2xl border animate-pulse motion-reduce:animate-none" />

      <KpiSkeleton count={4} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardSkeleton rows={4} />
        </div>
        <CardSkeleton rows={4} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton rows={5} />
        <CardSkeleton rows={5} />
      </div>

      <TableSkeleton cols={4} rows={3} />
    </div>
  );
}
