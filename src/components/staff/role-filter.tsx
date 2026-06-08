"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Role filter for the staff list. Rewrites the URL searchParams so the
 * filter is shareable and reload-safe, mirroring CatalogToolbar's pattern.
 */
export function RoleFilter({ current }: { current: string }) {
  const t = useTranslations("staff");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const onChange = (value: string) => {
    const params = new URLSearchParams();
    if (value) params.set("role", value);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  const selectClass =
    "border-input bg-surface text-foreground h-10 rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t("table.role")}
      className={selectClass}
    >
      <option value="">{t("filters.allRoles")}</option>
      <option value="ADMIN">{t("roles.ADMIN")}</option>
      <option value="MANAGER">{t("roles.MANAGER")}</option>
      <option value="B2B_SALON">{t("roles.B2B_SALON")}</option>
    </select>
  );
}
