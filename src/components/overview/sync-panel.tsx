import { Apple, Smartphone, RefreshCw, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import type { MobileSyncRow } from "@/lib/queries/overview";
import { Badge } from "@/components/ui/badge";

/**
 * System-sync panel: live read of the iOS/Android storefront app sync
 * status from the Setting table. Server component — renders the real rows
 * with a status badge, last-sync timestamp, and the synced-record counts.
 */
export async function SyncPanel({
  rows,
  locale,
}: {
  rows: MobileSyncRow[];
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "overview.sync" });

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusTone: Record<MobileSyncRow["status"], "success" | "warning" | "danger"> = {
    healthy: "success",
    degraded: "warning",
    offline: "danger",
  };

  return (
    <section className="bg-card shadow-soft border-border flex flex-col rounded-2xl border p-5">
      <header className="mb-4 flex items-center gap-2">
        <span className="bg-primary-soft text-primary flex size-9 items-center justify-center rounded-xl">
          <RefreshCw className="size-4.5" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-display text-foreground text-base font-semibold">{t("title")}</h3>
          <p className="text-muted-foreground text-xs">{t("subtitle")}</p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const Icon = row.platform === "iOS" ? Apple : Smartphone;
          return (
            <article
              key={row.platform}
              className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="bg-muted text-foreground flex size-8 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                <div className="flex flex-col">
                  <span className="text-foreground text-sm font-semibold">{row.platform}</span>
                  <span className="text-muted-foreground text-xs">
                    {t("version", { version: row.appVersion })}
                  </span>
                </div>
                <Badge tone={statusTone[row.status]} className="ms-auto">
                  {t(`status.${row.status}`)}
                </Badge>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                <Stat icon={<Clock className="size-3.5" />} label={t("lastSync")}>
                  <span className="tabular-nums">{dateFmt.format(new Date(row.lastSyncAt))}</span>
                </Stat>
                <Stat label={t("pending")}>
                  <span
                    className={`tabular-nums ${row.pendingPushes > 0 ? "text-warning-foreground font-semibold" : ""}`}
                  >
                    {formatNumber(row.pendingPushes, locale)}
                  </span>
                </Stat>
                <Stat label={t("products")}>
                  <span className="tabular-nums">
                    {formatNumber(row.syncedEntities.products, locale)}
                  </span>
                </Stat>
                <Stat label={t("orders")}>
                  <span className="tabular-nums">
                    {formatNumber(row.syncedEntities.orders, locale)}
                  </span>
                </Stat>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </dt>
      <dd className="text-foreground font-medium">{children}</dd>
    </div>
  );
}
