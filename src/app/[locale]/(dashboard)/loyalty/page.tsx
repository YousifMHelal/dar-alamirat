import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Gift, Award, Users, Crown } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getLoyaltySummary } from "@/lib/loyalty/queries";
import { formatNumber } from "@/lib/money";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Badge } from "@/components/ui/badge";

const MODULE_KEY = "loyalty";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "loyalty" });
  return { title: t("title") };
}

export default async function LoyaltyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "loyalty" });
  const summary = await getLoyaltySummary();

  const kpis: { icon: typeof Gift; label: string; value: string; tone: string }[] = [
    {
      icon: Gift,
      label: t("kpi.totalPoints"),
      value: formatNumber(summary.totalPoints, locale),
      tone: "bg-primary-soft text-primary",
    },
    {
      icon: Users,
      label: t("kpi.totalMembers"),
      value: formatNumber(summary.totalMembers, locale),
      tone: "bg-accent/15 text-accent-foreground",
    },
    {
      icon: Award,
      label: t("kpi.activeMembers"),
      value: formatNumber(summary.activeMembers, locale),
      tone: "bg-success/12 text-success",
    },
  ];

  const buckets: { key: keyof typeof summary.distribution; label: string }[] = [
    { key: "zero", label: t("distribution.zero") },
    { key: "low", label: t("distribution.low") },
    { key: "mid", label: t("distribution.mid") },
    { key: "high", label: t("distribution.high") },
    { key: "elite", label: t("distribution.elite") },
  ];
  const maxBucket = Math.max(1, ...buckets.map((b) => summary.distribution[b.key]));

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={t("title")} subtitle={t("subtitle")} icon={Gift} />

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card shadow-soft border-border rounded-2xl border p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {k.label}
              </span>
              <span className={`flex size-9 items-center justify-center rounded-xl ${k.tone}`}>
                <k.icon className="size-4" />
              </span>
            </div>
            <div className="text-foreground font-display text-2xl font-semibold tabular-nums">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leaderboard */}
        <div className="lg:col-span-2">
          <section className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
            <h2 className="border-border text-foreground border-b px-5 py-4 text-sm font-semibold">
              {t("leaderboard.title")}
            </h2>
            {summary.topMembers.length === 0 ? (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                {t("leaderboard.empty")}
              </p>
            ) : (
              <div className="scrollbar-subtle overflow-x-auto">
                <table className="w-full min-w-150 border-collapse text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                      <th className="px-5 py-3 text-start font-semibold">{t("leaderboard.rank")}</th>
                      <th className="px-5 py-3 text-start font-semibold">{t("leaderboard.member")}</th>
                      <th className="px-5 py-3 text-start font-semibold">{t("leaderboard.type")}</th>
                      <th className="px-5 py-3 text-start font-semibold">{t("leaderboard.city")}</th>
                      <th className="px-5 py-3 text-end font-semibold">{t("leaderboard.points")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topMembers.map((m, i) => (
                      <tr key={m.id} className="border-border border-b last:border-0">
                        <td className="px-5 py-3">
                          <span className="text-muted-foreground inline-flex items-center gap-1.5 tabular-nums">
                            {i < 3 ? (
                              <Crown
                                className={`size-3.5 ${
                                  i === 0
                                    ? "text-warning-foreground"
                                    : i === 1
                                      ? "text-muted-foreground"
                                      : "text-accent-foreground"
                                }`}
                              />
                            ) : null}
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/customers/${m.id}`}
                            className="text-foreground hover:text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {m.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          {m.type === "B2B_SALON" ? (
                            <Badge tone="primary">{t("type.B2B_SALON")}</Badge>
                          ) : (
                            <Badge tone="outline">{t("type.RETAIL")}</Badge>
                          )}
                        </td>
                        <td className="text-foreground px-5 py-3">{m.city}</td>
                        <td className="px-5 py-3 text-end">
                          <span className="text-foreground inline-flex items-center justify-end gap-1 font-medium tabular-nums">
                            <Gift className="text-muted-foreground size-3.5" />
                            {formatNumber(m.loyaltyPoints, locale)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Distribution */}
        <section className="bg-card shadow-soft border-border rounded-2xl border p-5">
          <h2 className="text-foreground mb-4 text-sm font-semibold">{t("distribution.title")}</h2>
          <ul className="flex flex-col gap-3">
            {buckets.map((b) => {
              const count = summary.distribution[b.key];
              const pct = Math.round((count / maxBucket) * 100);
              return (
                <li key={b.key}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="text-foreground font-medium tabular-nums">
                      {formatNumber(count, locale)}
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">{t("distribution.hint")}</p>
        </section>
      </div>
    </div>
  );
}
