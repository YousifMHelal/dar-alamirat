"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";

/**
 * Search + metadata-status filter for the SEO product list. URL-driven like
 * the other module toolbars; preserves the active tab.
 */
export function MetaToolbar({
  initialSearch,
  initialStatus,
}: {
  initialSearch: string;
  initialStatus: string;
}) {
  const t = useTranslations("seo.meta");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const debounce = useRef<number | undefined>(undefined);

  const push = useCallback(
    (next: { search?: string; status?: string }) => {
      const params = new URLSearchParams();
      params.set("tab", "meta");
      const s = next.search ?? search;
      const st = next.status ?? initialStatus;
      if (s.trim()) params.set("q", s.trim());
      if (st) params.set("meta", st);
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [search, initialStatus, pathname, router],
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
        value={initialStatus}
        onChange={(e) => push({ status: e.target.value })}
        aria-label={t("status")}
        className="border-input bg-surface text-foreground h-10 rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
      >
        <option value="">{t("all")}</option>
        <option value="with">{t("withMeta")}</option>
        <option value="without">{t("withoutMeta")}</option>
      </select>
    </div>
  );
}
