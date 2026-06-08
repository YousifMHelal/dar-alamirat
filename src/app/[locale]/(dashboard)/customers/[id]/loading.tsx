import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function CustomerDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-32" />
      <div className="border-border flex items-end justify-between border-b pb-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <CardSkeleton rows={2} />
          <CardSkeleton rows={4} />
        </div>
        <div className="flex flex-col gap-6">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
