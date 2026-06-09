import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, TrendingUp, Users, Wallet, ShoppingBag } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getAffiliateDetail } from "@/lib/affiliates/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { AffiliateForm } from "@/components/affiliates/affiliate-form";
import { Badge } from "@/components/ui/badge";
import { formatSar, formatNumber } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "affiliates" });
  const detail = await getAffiliateDetail(id);
  return {
    title: detail ? `${detail.name} — ${t("form.editTitle")}` : t("form.editTitle"),
  };
}

export default async function EditAffiliatePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess("affiliates", locale);

  const detail = await getAffiliateDetail(id);
  if (!detail) notFound();

  const t = await getTranslations({ locale, namespace: "affiliates" });

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const stats = [
    { key: "conversions", icon: ShoppingBag, value: formatNumber(detail.stats.conversionCount, locale) },
    { key: "revenue", icon: TrendingUp, value: formatSar(detail.stats.revenue, locale) },
    { key: "commission", icon: Wallet, value: formatSar(detail.stats.commission, locale) },
    { key: "newCustomers", icon: Users, value: formatNumber(detail.stats.newCustomers, locale) },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={detail.name}
        subtitle={`${detail.handle} · ${t(`channel.${detail.channel}`)}`}
        icon={Sparkles}
        action={
          <Link
            href="/affiliates"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" />
            {t("backToAffiliates")}
          </Link>
        }
      />

      {/* KPI cards — the document's "revenue & new-customers driven" metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="bg-card border-border shadow-soft rounded-2xl border p-5">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
              <s.icon className="size-4" />
              {t(`stats.${s.key}`)}
            </div>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <AffiliateForm locale={locale} detail={detail} />

      {/* Recent attributed orders */}
      <section className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
        <div className="border-border border-b px-6 py-4">
          <h2 className="font-display text-foreground text-base font-semibold">
            {t("conversions.title")}
          </h2>
        </div>
        {detail.conversions.length === 0 ? (
          <p className="text-muted-foreground px-6 py-10 text-center text-sm">
            {t("conversions.empty")}
          </p>
        ) : (
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-160 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("conversions.order")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("conversions.date")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("conversions.netRevenue")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("conversions.commission")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("conversions.customer")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.conversions.map((c) => (
                  <tr key={c.id} className="border-border border-b transition-colors last:border-0">
                    <td className="text-foreground px-4 py-3 font-medium tabular-nums">{c.orderNumber}</td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">{dateFmt.format(c.createdAt)}</td>
                    <td className="text-foreground px-4 py-3 tabular-nums">{formatSar(c.netRevenue, locale)}</td>
                    <td className="text-foreground px-4 py-3 tabular-nums">{formatSar(c.commission, locale)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={c.isNewCustomer ? "success" : "neutral"}>
                        {c.isNewCustomer ? t("conversions.new") : t("conversions.returning")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
