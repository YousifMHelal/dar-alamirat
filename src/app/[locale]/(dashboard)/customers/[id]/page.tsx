import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  Wallet,
  Gift,
} from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getDirection } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getCustomerDetail } from "@/lib/customers/queries";
import { formatNumber, formatSar } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge, OrderTypeBadge } from "@/components/orders/status-badge";

const MODULE_KEY = "customers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const customer = await getCustomerDetail(id);
  const t = await getTranslations({ locale, namespace: "customers" });
  return { title: customer ? customer.name : t("title") };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  const t = await getTranslations({ locale, namespace: "customers" });
  const tOrders = await getTranslations({ locale, namespace: "orders" });
  const isRtl = getDirection(locale) === "rtl";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/customers"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm transition-colors"
      >
        <BackIcon className="size-4" />
        {t("backToCustomers")}
      </Link>

      {/* Header */}
      <header className="border-border flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight">
            {customer.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("detail.customerSince", { date: dateFmt.format(customer.createdAt) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {customer.type === "B2B_SALON" ? (
            <Badge tone="primary">{t("type.B2B_SALON")}</Badge>
          ) : (
            <Badge tone="outline">{t("type.RETAIL")}</Badge>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* CRM notes */}
          <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
            <div className="text-muted-foreground mb-2 inline-flex items-center gap-1.5 text-xs font-medium">
              <StickyNote className="size-3.5" />
              {t("detail.crmNotes")}
            </div>
            <p className="text-foreground text-sm leading-relaxed">
              {customer.crmNotes || (
                <span className="text-muted-foreground italic">{t("detail.noNotes")}</span>
              )}
            </p>
          </section>

          {/* Order history */}
          <section className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
            <h2 className="border-border text-foreground border-b px-5 py-4 text-sm font-semibold">
              {t("detail.orderHistory")}
            </h2>
            {customer.orders.length === 0 ? (
              <p className="text-muted-foreground px-5 py-6 text-sm">{t("detail.noOrders")}</p>
            ) : (
              <div className="scrollbar-subtle overflow-x-auto">
                <table className="w-full min-w-150 border-collapse text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                      <th className="px-5 py-3 text-start font-semibold">{tOrders("table.orderNumber")}</th>
                      <th className="px-5 py-3 text-start font-semibold">{tOrders("table.type")}</th>
                      <th className="px-5 py-3 text-start font-semibold">{tOrders("table.status")}</th>
                      <th className="px-5 py-3 text-start font-semibold">{tOrders("table.placedAt")}</th>
                      <th className="px-5 py-3 text-end font-semibold">{tOrders("table.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((o) => (
                      <tr key={o.id} className="border-border border-b last:border-0">
                        <td className="px-5 py-3">
                          <Link
                            href={`/orders/${o.id}`}
                            className="text-foreground hover:text-primary font-medium tabular-nums underline-offset-4 hover:underline"
                          >
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <OrderTypeBadge type={o.type} label={tOrders(`type.${o.type}`)} />
                        </td>
                        <td className="px-5 py-3">
                          <OrderStatusBadge status={o.status} label={tOrders(`status.${o.status}`)} />
                        </td>
                        <td className="text-muted-foreground px-5 py-3 tabular-nums">
                          {dateFmt.format(o.placedAt)}
                        </td>
                        <td className="text-foreground px-5 py-3 text-end font-medium tabular-nums">
                          {formatSar(o.total, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Credit transactions */}
          {customer.creditAccount && (
            <section className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
              <h2 className="border-border text-foreground border-b px-5 py-4 text-sm font-semibold">
                {t("detail.creditTransactions")}
              </h2>
              {customer.creditAccount.transactions.length === 0 ? (
                <p className="text-muted-foreground px-5 py-6 text-sm">{t("detail.noTransactions")}</p>
              ) : (
                <ul className="divide-border divide-y">
                  {customer.creditAccount.transactions.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div>
                        <div className="text-foreground text-sm font-medium">
                          {t(`creditType.${tx.type}`)}
                        </div>
                        {tx.note && <div className="text-muted-foreground text-xs">{tx.note}</div>}
                        <div className="text-muted-foreground text-xs tabular-nums">
                          {dateFmt.format(tx.date)}
                        </div>
                      </div>
                      <span
                        className={`text-sm font-medium tabular-nums ${
                          tx.type === "PAYMENT" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {tx.type === "PAYMENT" ? "−" : "+"}
                        {formatSar(tx.amount, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* ── Side column ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
            <h2 className="text-foreground mb-3 text-sm font-semibold">{t("detail.contact")}</h2>
            <div className="text-muted-foreground flex flex-col gap-2 text-sm">
              <span className="inline-flex items-center gap-2" dir="ltr">
                <Phone className="size-3.5 shrink-0" />
                <span className="tabular-nums">{customer.phone}</span>
              </span>
              {customer.email && (
                <span className="inline-flex items-center gap-2 break-all">
                  <Mail className="size-3.5 shrink-0" />
                  {customer.email}
                </span>
              )}
              <span className="inline-flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {customer.addressLine}
                  <br />
                  {customer.city}
                </span>
              </span>
            </div>

            <div className="border-border mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div>
                <dt className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  <Gift className="size-3" />
                  {t("detail.loyalty")}
                </dt>
                <dd className="text-foreground font-medium tabular-nums">
                  {formatNumber(customer.loyaltyPoints, locale)}
                </dd>
              </div>
              {customer.pricingTier && (
                <div>
                  <dt className="text-muted-foreground text-xs">{t("detail.pricingTier")}</dt>
                  <dd className="text-foreground font-medium">{customer.pricingTier.name}</dd>
                </div>
              )}
            </div>
          </section>

          {customer.creditAccount && (
            <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
              <h2 className="text-foreground mb-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                <Wallet className="size-4" />
                {t("detail.creditAccount")}
              </h2>
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("detail.creditBalance")}</dt>
                  <dd className="text-foreground font-medium tabular-nums">
                    {formatSar(customer.creditAccount.balance, locale)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("detail.creditLimit")}</dt>
                  <dd className="text-foreground font-medium tabular-nums">
                    {formatSar(customer.creditAccount.creditLimit, locale)}
                  </dd>
                </div>
              </dl>
              <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (Number(customer.creditAccount.balance) /
                        Math.max(1, Number(customer.creditAccount.creditLimit))) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
