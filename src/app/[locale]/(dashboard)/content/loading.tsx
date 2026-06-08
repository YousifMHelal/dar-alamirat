import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function ContentLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3.5 w-80" />
        </div>
      </div>

      <div className="border-border flex gap-1 border-b">
        <Skeleton className="h-10 w-40 rounded-t-lg" />
        <Skeleton className="h-10 w-36 rounded-t-lg" />
      </div>

      <CardSkeleton rows={5} />
      <CardSkeleton rows={4} />
    </div>
  );
}
