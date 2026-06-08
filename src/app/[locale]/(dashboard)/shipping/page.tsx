import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MapPin, Warehouse, Boxes, Truck } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listShipments, listWarehouses } from "@/lib/shipping/queries";
import { formatNumber } from "@/lib/money";
import { CatalogHeader } from "@/components/catalog/page-header";
import { ShippingToolbar } from "@/components/shipping/shipping-toolbar";
import { ShipmentStatusBadge } from "@/components/orders/status-badge";

const MODULE_KEY = "shipping";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shipping" });
  return { title: t("title") };
}

export default async function ShippingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ carrier?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "shipping" });

  const carrier = sp.carrier === "ARAMEX" || sp.carrier === "SMSA" || sp.carrier === "SPL" ? sp.carrier : undefined;
  const status =
    sp.status === "PENDING" ||
    sp.status === "IN_TRANSIT" ||
    sp.status === "DELIVERED" ||
    sp.status === "RETURNED"
      ? sp.status
      : undefined;
  const page = Number(sp.page) || 1;

  const [{ rows, total, pageCount }, warehouses] = await Promise.all([
    listShipments({ carrier, status, page }),
    listWarehouses(),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (carrier) params.set("carrier", carrier);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/shipping?${qs}` : "/shipping";
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={t("title")} subtitle={t("subtitle")} icon={MapPin} />

      {/* Warehouse / zones summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {warehouses.map((w) => (
          <div key={w.id} className="bg-card shadow-soft border-border rounded-2xl border p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="bg-primary-soft text-primary flex size-10 items-center justify-center rounded-xl">
                <Warehouse className="size-5" />
              </span>
              <div>
                <div className="text-foreground text-sm font-semibold">{w.name}</div>
                <div className="text-muted-foreground text-xs">
                  {w.code} · {w.city}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  <Truck className="size-3" />
                  {t("warehouses.shipments")}
                </dt>
                <dd className="text-foreground font-medium tabular-nums">
                  {formatNumber(w._count.shipments, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  <Boxes className="size-3" />
                  {t("warehouses.stockCells")}
                </dt>
                <dd className="text-foreground font-medium tabular-nums">
                  {formatNumber(w._count.inventoryItems, locale)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <ShippingToolbar initialCarrier={sp.carrier ?? ""} initialStatus={sp.status ?? ""} />

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-200 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.orderNumber")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.warehouse")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.carrier")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.waybill")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.date")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr
                    key={s.id}
                    className="border-border hover:bg-muted/50 group border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${s.order.id}`}
                        className="text-foreground hover:text-primary font-medium tabular-nums underline-offset-4 group-hover:underline"
                      >
                        {s.order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {s.warehouse ? (
                        <span className="text-foreground inline-flex items-center gap-1.5">
                          <Warehouse className="text-muted-foreground size-3.5" />
                          {s.warehouse.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t("table.unassigned")}</span>
                      )}
                    </td>
                    <td className="text-foreground px-4 py-3">{t(`carrier.${s.carrier}`)}</td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs tabular-nums">
                      {s.waybillNumber ?? "—"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 tabular-nums">
                      {dateFmt.format(s.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <ShipmentStatusBadge status={s.status} label={t(`status.${s.status}`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border flex items-center justify-between gap-4 border-t px-4 py-3">
            <p className="text-muted-foreground text-xs">
              {t("pagination.showing", { count: rows.length, total })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("pagination.page", { page, pageCount })}
              </span>
              <PagerLink href={pageHref(page - 1)} disabled={page <= 1} label={t("pagination.prev")} />
              <PagerLink href={pageHref(page + 1)} disabled={page >= pageCount} label={t("pagination.next")} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PagerLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="border-border text-muted-foreground inline-flex h-8 cursor-not-allowed items-center rounded-lg border px-3 text-xs opacity-50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-8 items-center rounded-lg border px-3 text-xs transition-colors"
    >
      {label}
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-card shadow-soft border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center">
      <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl">
        <MapPin className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
