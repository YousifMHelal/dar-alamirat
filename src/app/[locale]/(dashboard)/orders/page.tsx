import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus, PackageOpen, MapPin, Split } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listOrders } from "@/lib/orders/queries";
import { formatSar } from "@/lib/money";
import { OrderStatus, OrderType } from "@/generated/prisma/enums";
import { OrdersHeader } from "@/components/orders/page-header";
import { OrdersToolbar } from "@/components/orders/orders-toolbar";
import { OrderStatusBadge, OrderTypeBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";

const MODULE_KEY = "orders";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orders" });
  return { title: t("title") };
}

/** Coerce a raw searchParam into a valid enum value, else undefined. */
function asEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "orders" });

  const status = asEnum(sp.status, Object.values(OrderStatus));
  const type = asEnum(sp.type, Object.values(OrderType));
  const search = sp.q ?? "";
  const page = Number(sp.page) || 1;

  const { rows, total, pageCount } = await listOrders({ search, status, type, page });

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Preserve active filters when paginating.
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/orders?${qs}` : "/orders";
  };

  return (
    <div className="flex flex-col gap-6">
      <OrdersHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link href="/orders/new">
            <Button>
              <Plus />
              {t("newOrder")}
            </Button>
          </Link>
        }
      />

      <OrdersToolbar
        initialSearch={search}
        initialStatus={status ?? ""}
        initialType={type ?? ""}
      />

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-210 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.orderNumber")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.customer")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.type")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("table.total")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.warehouse")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("table.placedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr
                    key={order.id}
                    className="border-border hover:bg-muted/50 group border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-foreground hover:text-primary font-medium tabular-nums underline-offset-4 group-hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground font-medium">{order.customer.name}</div>
                      <div className="text-muted-foreground text-xs">{order.customer.city}</div>
                    </td>
                    <td className="px-4 py-3">
                      <OrderTypeBadge type={order.type} label={t(`type.${order.type}`)} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} label={t(`status.${order.status}`)} />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <span className="text-foreground font-medium tabular-nums">
                        {formatSar(order.total, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.assignedWarehouse ? (
                        <span className="text-foreground inline-flex items-center gap-1.5">
                          <MapPin className="text-muted-foreground size-3.5" />
                          {order.assignedWarehouse.name}
                          {order._count.shipments > 1 && (
                            <span className="text-primary inline-flex items-center gap-0.5 text-xs">
                              <Split className="size-3" />
                              {t("table.split")}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">{t("table.unassigned")}</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-end tabular-nums">
                      {dateFmt.format(order.placedAt)}
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
        <PackageOpen className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
