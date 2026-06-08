"use client";

import { useState, useTransition, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { OrderStatus, OrderType } from "@/generated/prisma/enums";

/**
 * Client toolbar for the orders list: free-text search + status/type
 * filters. Each change rewrites the URL searchParams (the page is
 * server-rendered from them), so filters are shareable and survive reload.
 * Search is debounced to avoid a navigation per keystroke.
 */
export function OrdersToolbar({
  initialSearch,
  initialStatus,
  initialType,
}: {
  initialSearch: string;
  initialStatus: string;
  initialType: string;
}) {
  const t = useTranslations("orders");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  const pushParams = useCallback(
    (next: { search?: string; status?: string; type?: string }) => {
      const params = new URLSearchParams();
      const s = next.search ?? search;
      const st = next.status ?? initialStatus;
      const ty = next.type ?? initialType;
      if (s.trim()) params.set("q", s.trim());
      if (st) params.set("status", st);
      if (ty) params.set("type", ty);
      // Any filter change resets to page 1.
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [search, initialStatus, initialType, pathname, router],
  );

  // Debounce search input → URL.
  const onSearchChange = (value: string) => {
    setSearch(value);
    window.clearTimeout((onSearchChange as unknown as { _t?: number })._t);
    (onSearchChange as unknown as { _t?: number })._t = window.setTimeout(() => {
      pushParams({ search: value });
    }, 350);
  };

  const selectClass =
    "border-input bg-surface text-foreground h-10 rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
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
        value={initialStatus}
        onChange={(e) => pushParams({ status: e.target.value })}
        aria-label={t("table.status")}
        className={selectClass}
      >
        <option value="">{t("filters.allStatuses")}</option>
        {Object.values(OrderStatus).map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>

      <select
        value={initialType}
        onChange={(e) => pushParams({ type: e.target.value })}
        aria-label={t("table.type")}
        className={selectClass}
      >
        <option value="">{t("filters.allTypes")}</option>
        {Object.values(OrderType).map((ty) => (
          <option key={ty} value={ty}>
            {t(`type.${ty}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
