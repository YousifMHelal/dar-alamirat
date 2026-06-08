"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";

/**
 * Client toolbar for the catalog list: free-text search + category / brand /
 * status filters. Every change rewrites the URL searchParams (the page is
 * server-rendered from them), so filters are shareable and reload-safe.
 * Search is debounced to avoid a navigation per keystroke.
 */
export function CatalogToolbar({
  locale,
  initialSearch,
  initialCategory,
  initialBrand,
  initialStatus,
  categories,
  brands,
}: {
  locale: string;
  initialSearch: string;
  initialCategory: string;
  initialBrand: string;
  initialStatus: string;
  categories: Array<{ id: string; nameEn: string; nameAr: string }>;
  brands: string[];
}) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const debounce = useRef<number | undefined>(undefined);

  const pushParams = useCallback(
    (next: { search?: string; category?: string; brand?: string; status?: string }) => {
      const params = new URLSearchParams();
      const s = next.search ?? search;
      const c = next.category ?? initialCategory;
      const b = next.brand ?? initialBrand;
      const st = next.status ?? initialStatus;
      if (s.trim()) params.set("q", s.trim());
      if (c) params.set("category", c);
      if (b) params.set("brand", b);
      if (st) params.set("status", st);
      const qs = params.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
    },
    [search, initialCategory, initialBrand, initialStatus, pathname, router],
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
        value={initialCategory}
        onChange={(e) => pushParams({ category: e.target.value })}
        aria-label={t("table.category")}
        className={selectClass}
      >
        <option value="">{t("filters.allCategories")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {locale === "ar" ? c.nameAr : c.nameEn}
          </option>
        ))}
      </select>

      <select
        value={initialBrand}
        onChange={(e) => pushParams({ brand: e.target.value })}
        aria-label={t("table.brand")}
        className={selectClass}
      >
        <option value="">{t("filters.allBrands")}</option>
        {brands.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <select
        value={initialStatus}
        onChange={(e) => pushParams({ status: e.target.value })}
        aria-label={t("table.status")}
        className={selectClass}
      >
        <option value="">{t("filters.allStatuses")}</option>
        <option value="active">{t("filters.active")}</option>
        <option value="inactive">{t("filters.inactive")}</option>
      </select>
    </div>
  );
}
