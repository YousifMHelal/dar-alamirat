"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Carrier + status filters for the shipments list. Mirrors CatalogToolbar's
 * URL-driven filter pattern (no free-text search — shipments don't have a
 * natural search field beyond the order number, which is shown in-row).
 */
export function ShippingToolbar({
  initialCarrier,
  initialStatus,
}: {
  initialCarrier: string;
  initialStatus: string;
}) {
  const t = useTranslations("shipping");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const pushParams = (next: { carrier?: string; status?: string }) => {
    const params = new URLSearchParams();
    const c = next.carrier ?? initialCarrier;
    const s = next.status ?? initialStatus;
    if (c) params.set("carrier", c);
    if (s) params.set("status", s);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  const selectClass =
    "border-input bg-surface text-foreground h-10 rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <select
        value={initialCarrier}
        onChange={(e) => pushParams({ carrier: e.target.value })}
        aria-label={t("table.carrier")}
        className={selectClass}
      >
        <option value="">{t("filters.allCarriers")}</option>
        <option value="ARAMEX">{t("carrier.ARAMEX")}</option>
        <option value="SMSA">{t("carrier.SMSA")}</option>
        <option value="SPL">{t("carrier.SPL")}</option>
      </select>

      <select
        value={initialStatus}
        onChange={(e) => pushParams({ status: e.target.value })}
        aria-label={t("table.status")}
        className={selectClass}
      >
        <option value="">{t("filters.allStatuses")}</option>
        <option value="PENDING">{t("status.PENDING")}</option>
        <option value="IN_TRANSIT">{t("status.IN_TRANSIT")}</option>
        <option value="DELIVERED">{t("status.DELIVERED")}</option>
        <option value="RETURNED">{t("status.RETURNED")}</option>
      </select>
    </div>
  );
}
