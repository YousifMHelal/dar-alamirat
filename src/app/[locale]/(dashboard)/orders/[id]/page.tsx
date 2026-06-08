import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  StickyNote,
  Split,
  Warehouse,
} from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getDirection } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getOrderDetail } from "@/lib/orders/queries";
import { formatSar, formatNumber } from "@/lib/money";
import {
  OrderStatusBadge,
  OrderTypeBadge,
  PaymentStatusBadge,
  ShipmentStatusBadge,
} from "@/components/orders/status-badge";

const MODULE_KEY = "orders";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const order = await getOrderDetail(id);
  const t = await getTranslations({ locale, namespace: "orders" });
  return { title: order ? t("detail.title", { orderNumber: order.orderNumber }) : t("title") };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const order = await getOrderDetail(id);
  if (!order) notFound();

  const t = await getTranslations({ locale, namespace: "orders" });
  const isRtl = getDirection(locale) === "rtl";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const productName = (p: { nameEn: string; nameAr: string }) =>
    locale === "ar" ? p.nameAr : p.nameEn;

  const isSplit = order.shipments.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/orders"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm transition-colors"
      >
        <BackIcon className="size-4" />
        {t("backToOrders")}
      </Link>

      {/* Header */}
      <header className="border-border flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight tabular-nums">
            {order.orderNumber}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("detail.placedOn", { date: dateFmt.format(order.placedAt) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderTypeBadge type={order.type} label={t(`type.${order.type}`)} />
          <OrderStatusBadge status={order.status} label={t(`status.${order.status}`)} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Line items */}
          <section className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
            <h2 className="border-border text-foreground border-b px-5 py-4 text-sm font-semibold">
              {t("detail.lineItems")}
            </h2>
            <div className="scrollbar-subtle overflow-x-auto">
              <table className="w-full min-w-150 border-collapse text-sm">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                    <th className="px-5 py-3 text-start font-semibold">{t("detail.item")}</th>
                    <th className="px-5 py-3 text-end font-semibold">{t("detail.qty")}</th>
                    <th className="px-5 py-3 text-end font-semibold">{t("detail.unitPrice")}</th>
                    <th className="px-5 py-3 text-end font-semibold">{t("detail.lineTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-border border-b last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {item.variant.colorHex && (
                            <span
                              className="border-border size-3.5 shrink-0 rounded-full border"
                              style={{ backgroundColor: item.variant.colorHex }}
                              aria-hidden
                            />
                          )}
                          <div>
                            <div className="text-foreground font-medium">
                              {productName(item.variant.product)}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {[
                                item.variant.product.brand,
                                item.variant.capacity,
                                item.variant.colorName,
                              ]
                                .filter(Boolean)
                                .join(" · ")}{" "}
                              · {t("detail.sku")} {item.variant.variantSku}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-foreground px-5 py-3 text-end tabular-nums">
                        {formatNumber(item.quantity, locale)}
                      </td>
                      <td className="text-muted-foreground px-5 py-3 text-end tabular-nums">
                        {formatSar(item.unitPrice, locale)}
                      </td>
                      <td className="text-foreground px-5 py-3 text-end font-medium tabular-nums">
                        {formatSar(item.lineTotal, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* VAT breakdown */}
            <dl className="border-border bg-surface-muted/40 flex flex-col gap-2 border-t px-5 py-4 text-sm">
              <SummaryRow label={t("detail.subtotal")} value={formatSar(order.subtotal, locale)} />
              <SummaryRow label={t("detail.vat")} value={formatSar(order.vatAmount, locale)} />
              <div className="border-border mt-1 flex items-center justify-between border-t pt-3">
                <dt className="text-foreground text-base font-semibold">{t("detail.total")}</dt>
                <dd className="text-foreground text-base font-semibold tabular-nums">
                  {formatSar(order.total, locale)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Shipments */}
          <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-foreground text-sm font-semibold">{t("detail.shipments")}</h2>
              {isSplit && (
                <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
                  <Split className="size-3.5" />
                  {t("detail.splitNote", { count: order.shipments.length })}
                </span>
              )}
            </div>
            {order.shipments.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("detail.noShipments")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {order.shipments.map((s) => (
                  <li
                    key={s.id}
                    className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-primary-soft text-primary flex size-9 items-center justify-center rounded-lg">
                        <Warehouse className="size-4" />
                      </span>
                      <div>
                        <div className="text-foreground text-sm font-medium">
                          {s.warehouse
                            ? t("detail.fromWarehouse", { warehouse: s.warehouse.name })
                            : t("detail.shipments")}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {s.carrier}
                          {s.waybillNumber && (
                            <>
                              {" · "}
                              {t("detail.waybill")} {s.waybillNumber}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <ShipmentStatusBadge status={s.status} label={t(`shipmentStatus.${s.status}`)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── Side column ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Customer / CRM */}
          <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
            <h2 className="text-foreground mb-3 text-sm font-semibold">{t("detail.customer")}</h2>
            <div className="text-foreground text-base font-medium">{order.customer.name}</div>
            <div className="text-muted-foreground mt-3 flex flex-col gap-2 text-sm">
              <span className="inline-flex items-center gap-2" dir="ltr">
                <Phone className="size-3.5 shrink-0" />
                <span className="tabular-nums">{order.customer.phone}</span>
              </span>
              {order.customer.email && (
                <span className="inline-flex items-center gap-2 break-all">
                  <Mail className="size-3.5 shrink-0" />
                  {order.customer.email}
                </span>
              )}
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-3.5 shrink-0" />
                {order.customer.addressLine}
              </span>
            </div>

            <div className="border-border mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">{t("detail.loyalty")}</dt>
                <dd className="text-foreground font-medium tabular-nums">
                  {formatNumber(order.customer.loyaltyPoints, locale)}
                </dd>
              </div>
              {order.customer.pricingTier && (
                <div>
                  <dt className="text-muted-foreground text-xs">{t("detail.pricingTier")}</dt>
                  <dd className="text-foreground font-medium">{order.customer.pricingTier.name}</dd>
                </div>
              )}
            </div>

            <div className="bg-surface-muted/50 border-border mt-4 rounded-xl border p-3">
              <div className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium">
                <StickyNote className="size-3.5" />
                {t("detail.crmNotes")}
              </div>
              <p className="text-foreground text-sm leading-relaxed">
                {order.customer.crmNotes || (
                  <span className="text-muted-foreground italic">{t("detail.noNotes")}</span>
                )}
              </p>
            </div>
          </section>

          {/* Assigned warehouse */}
          {order.assignedWarehouse && (
            <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
              <h2 className="text-foreground mb-3 text-sm font-semibold">
                {t("detail.assignedWarehouse")}
              </h2>
              <div className="flex items-center gap-3">
                <span className="bg-accent/15 text-accent-foreground flex size-10 items-center justify-center rounded-xl">
                  <MapPin className="size-5" />
                </span>
                <div>
                  <div className="text-foreground font-medium">{order.assignedWarehouse.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {order.assignedWarehouse.code} · {order.assignedWarehouse.city}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Payments */}
          <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
            <h2 className="text-foreground mb-3 text-sm font-semibold">{t("detail.payments")}</h2>
            {order.payments.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("detail.noPayments")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-sm font-medium">
                        {t(`paymentMethod.${p.method}`)}
                      </span>
                      <PaymentStatusBadge status={p.status} label={t(`paymentStatus.${p.status}`)} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground tabular-nums">
                        {formatSar(p.amount, locale)}
                      </span>
                      {p.gatewayFee && (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {t("detail.gatewayFee")}: {formatSar(p.gatewayFee, locale)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
