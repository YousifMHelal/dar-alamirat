import { KpiSkeleton, CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function FinancialsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-3 border-b pb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </header>

      <KpiSkeleton count={4} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton rows={6} />
        <CardSkeleton rows={6} />
      </div>
    </div>
  );
}
