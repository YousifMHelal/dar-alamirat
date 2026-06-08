"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import type { WarehouseColumn } from "@/lib/inventory/queries";

/**
 * Toolbar for the stock matrix: search + a "low stock only" toggle (scoped
 * to an optional warehouse). URL-driven like the other module toolbars so
 * the server re-queries and the view is shareable. Preserves the active tab.
 */
export function MatrixToolbar({
  initialSearch,
  initialLow,
  initialWarehouse,
  warehouses,
}: {
  initialSearch: string;
  initialLow: boolean;
  initialWarehouse: string;
  warehouses: WarehouseColumn[];
}) {
  const t = useTranslations("inventory.matrix");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const debounce = useRef<number | undefined>(undefined);

  const push = useCallback(
    (next: { search?: string; low?: boolean; warehouse?: string }) => {
      const params = new URLSearchParams();
      params.set("tab", "matrix");
      const s = next.search ?? search;
      const low = next.low ?? initialLow;
      const wh = next.warehouse ?? initialWarehouse;
      if (s.trim()) params.set("q", s.trim());
      if (low) params.set("low", "1");
      if (wh) params.set("wh", wh);
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [search, initialLow, initialWarehouse, pathname, router],
  );

  const onSearchChange = (value: string) => {
    setSearch(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => push({ search: value }), 350);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
        {isPending && (
          <Loader2 className="text-muted-foreground absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
        )}
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="ps-9"
        />
      </div>

      <select
        value={initialWarehouse}
        onChange={(e) => push({ warehouse: e.target.value })}
        aria-label={t("allWarehouses")}
        className="border-input bg-surface text-foreground h-10 rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
      >
        <option value="">{t("allWarehouses")}</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      <label className="border-input bg-surface text-foreground flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm shadow-soft">
        <input
          type="checkbox"
          checked={initialLow}
          onChange={(e) => push({ low: e.target.checked })}
          className="border-input text-destructive focus-visible:ring-ring/30 size-4 rounded border focus-visible:ring-2"
        />
        {t("lowStockOnly")}
      </label>
    </div>
  );
}
