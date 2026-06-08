import { cn } from "@/lib/utils";

/**
 * Shimmer placeholder for async content. Use inside Suspense boundaries or
 * while mutations are pending. Respects prefers-reduced-motion via CSS.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-muted animate-pulse rounded-lg motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

/** A full card-shaped skeleton matching the portal's card style. */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-card shadow-soft border-border rounded-2xl border p-5">
      <Skeleton className="mb-4 h-5 w-2/5" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${75 + (i % 3) * 10}%` }} />
        ))}
      </div>
    </div>
  );
}

/** KPI row skeleton — 4 cards matching the KPI grid. */
export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card shadow-soft border-border rounded-2xl border p-5">
          <div className="mb-3 flex items-start justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="size-9 rounded-xl" />
          </div>
          <Skeleton className="mb-2 h-7 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

/** Table skeleton — header + N body rows. */
export function TableSkeleton({
  cols = 5,
  rows = 6,
}: {
  cols?: number;
  rows?: number;
}) {
  return (
    <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
      <div className="border-border border-b px-4 py-3">
        <div className="flex gap-6">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3" style={{ flex: i === 0 ? 2 : 1 }} />
          ))}
        </div>
      </div>
      <div className="divide-border divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-6 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4" style={{ flex: c === 0 ? 2 : 1 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
