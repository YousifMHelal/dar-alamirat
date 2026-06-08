"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";

/**
 * Client toolbar for the customers list: free-text search (name/phone) +
 * type filter. Mirrors CatalogToolbar — every change rewrites the URL
 * searchParams so filters are shareable and reload-safe.
 */
export function CustomersToolbar({
  initialSearch,
  initialType,
}: {
  initialSearch: string;
  initialType: string;
}) {
  const t = useTranslations("customers");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const debounce = useRef<number | undefined>(undefined);

  const pushParams = useCallback(
    (next: { search?: string; type?: string }) => {
      const params = new URLSearchParams();
      const s = next.search ?? search;
      const ty = next.type ?? initialType;
      if (s.trim()) params.set("q", s.trim());
      if (ty) params.set("type", ty);
      const qs = params.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
    },
    [search, initialType, pathname, router],
  );

  const onSearchChange = (value: string) => {
    setSearch(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => pushParams({ search: value }), 350);
  };

  const selectClass =
    "border-input bg-surface text-foreground h-10 rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
        value={initialType}
        onChange={(e) => pushParams({ type: e.target.value })}
        aria-label={t("table.type")}
        className={selectClass}
      >
        <option value="">{t("filters.allTypes")}</option>
        <option value="RETAIL">{t("type.RETAIL")}</option>
        <option value="B2B_SALON">{t("type.B2B_SALON")}</option>
      </select>
    </div>
  );
}
