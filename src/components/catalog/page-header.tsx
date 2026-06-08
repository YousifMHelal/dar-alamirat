import { ShoppingBag, type LucideIcon } from "lucide-react";

/**
 * Editorial header for Catalog pages — mirrors the Orders/Overview header
 * (icon chip + display title + lede) so the module sits visually with the
 * rest of the portal. `action` slots primary CTAs on the end.
 */
export function CatalogHeader({
  title,
  subtitle,
  icon: Icon = ShoppingBag,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <header className="border-border flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-3">
        <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
          <Icon className="size-5" />
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
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}
