import { Truck } from "lucide-react";

/**
 * Editorial header for Orders pages — mirrors the ModulePage header style
 * (icon chip + display title + lede) so the activated module sits visually
 * with the rest of the portal. `action` slots a primary CTA on the end.
 */
export function OrdersHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="border-border flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-3">
        <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
          <Truck className="size-5" />
        </span>
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
