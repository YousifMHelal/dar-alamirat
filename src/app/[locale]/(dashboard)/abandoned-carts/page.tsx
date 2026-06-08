import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShoppingCart, BadgeCheck, Coins, BellRing, PackageX } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listAbandonedCarts, getAbandonedCartStats } from "@/lib/abandoned-carts/queries";
import { formatNumber, formatSar } from "@/lib/format";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Badge } from "@/components/ui/badge";
import { CartActions } from "@/components/abandoned-carts/cart-actions";

const MODULE_KEY = "abandonedCarts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "abandonedCarts" });
  return { title: t("title") };
}

const STATUS_TONE = {
  ACTIVE: "info",
  RECOVERED: "success",
  EXPIRED: "neutral",
} as const;

export default async function AbandonedCartsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "abandonedCarts" });

  const status =
    sp.status === "ACTIVE" || sp.status === "RECOVERED" || sp.status === "EXPIRED" ? sp.status : undefined;
  const page = Number(sp.page) || 1;

  const [{ rows, total, pageCount }, stats] = await Promise.all([
    listAbandonedCarts({ status, page }),
    getAbandonedCartStats(),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/abandoned-carts?${qs}` : "/abandoned-carts";
  };
  const statusHref = (s: string) => `/abandoned-carts?${new URLSearchParams({ status: s }).toString()}`;
  const statusOptions = ["ACTIVE", "RECOVERED", "EXPIRED"] as const;

  const cards = [
    { icon: ShoppingCart, label: t("stats.total"), value: formatNumber(stats.total, locale), tone: "primary" as const },
    {
      icon: BadgeCheck,
      label: t("stats.recoveryRate"),
      value: `${formatNumber(stats.recoveryRate, locale)}%`,
      tone: "success" as const,
    },
    {
      icon: Coins,
      label: t("stats.potentialRevenue"),
      value: formatSar(stats.potentialRevenue, locale),
      tone: "accent" as const,
    },
    {
      icon: BellRing,
      label: t("stats.remindersSent"),
      value: formatNumber(stats.remindersSent, locale),
      tone: "info" as const,
    },
  ];
  const toneClass: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/12 text-success",
    info: "bg-accent/15 text-accent-foreground",
    accent: "bg-warning/20 text-warning-foreground",
  };

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={t("title")} subtitle={t("subtitle")} icon={ShoppingCart} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-5">
              <span className={`flex size-10 items-center justify-center rounded-xl ${toneClass[card.tone]}`}>
                <Icon className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs font-medium">{card.label}</p>
                <p className="font-display text-foreground text-xl font-semibold tabular-nums">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip href="/abandoned-carts" active={!status} label={t("filter.all")} />
        {statusOptions.map((s) => (
          <FilterChip key={s} href={statusHref(s)} active={status === s} label={t(`status.${s}`)} />
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-240 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.customer")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.items")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.value")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.lastActivity")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-border hover:bg-muted/50 border-b transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <div className="text-foreground font-medium">{c.customer.name}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs" dir="ltr">
                        {c.customer.phone}
                      </div>
                    </td>
                    <td className="text-foreground px-4 py-3 tabular-nums">{formatNumber(c.itemCount, locale)}</td>
                    <td className="text-foreground px-4 py-3 font-medium tabular-nums">{formatSar(c.subtotal, locale)}</td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">{dateFmt.format(c.lastActivityAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
                      {c.reminderSentAt && (
                        <div className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs">
                          <BellRing className="size-3" />
                          {t("table.reminderSent")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CartActions id={c.id} status={c.status} recoveryLink={c.recoveryLink} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border flex items-center justify-between gap-4 border-t px-4 py-3">
            <p className="text-muted-foreground text-xs">{t("pagination.showing", { count: rows.length, total })}</p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">{t("pagination.page", { page, pageCount })}</span>
              <PagerLink href={pageHref(page - 1)} disabled={page <= 1} label={t("pagination.prev")} />
              <PagerLink href={pageHref(page + 1)} disabled={page >= pageCount} label={t("pagination.next")} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "bg-primary text-primary-foreground inline-flex h-8 items-center rounded-full px-4 text-xs font-medium transition-colors"
          : "border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-8 items-center rounded-full border px-4 text-xs transition-colors"
      }
    >
      {label}
    </Link>
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
    <Link href={href} className="border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-8 items-center rounded-lg border px-3 text-xs transition-colors">
      {label}
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-card shadow-soft border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center">
      <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl">
        <PackageX className="size-6" />
      </span>
      <h2 className="font-display text-foreground text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
