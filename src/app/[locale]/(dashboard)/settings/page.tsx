import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Settings,
  MessageCircle,
  Receipt,
  CreditCard,
  Truck,
  KeyRound,
  CheckCircle2,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listIntegrationSettings, type IntegrationGroup } from "@/lib/settings/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Badge } from "@/components/ui/badge";

const MODULE_KEY = "settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });
  return { title: t(`${MODULE_KEY}.title`) };
}

const GROUP_ICON: Record<IntegrationGroup, LucideIcon> = {
  messaging: MessageCircle,
  tax: Receipt,
  payments: CreditCard,
  shipping: Truck,
};

const GROUP_ORDER: IntegrationGroup[] = ["messaging", "tax", "payments", "shipping"];

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "settings" });
  const tm = await getTranslations({ locale, namespace: "modules" });

  const integrations = await listIntegrationSettings();
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: integrations.filter((i) => i.group === group),
  })).filter((g) => g.items.length > 0);

  const enabledCount = integrations.filter((i) => i.enabled).length;

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={tm(`${MODULE_KEY}.title`)} subtitle={tm(`${MODULE_KEY}.description`)} icon={Settings} />

      <section className="bg-card shadow-soft border-border flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5">
        <div className="flex items-center gap-3">
          <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
            <KeyRound className="size-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-foreground text-base font-semibold">{t("integrations.title")}</h2>
            <p className="text-muted-foreground text-xs">{t("integrations.subtitle")}</p>
          </div>
        </div>
        <Badge tone="outline" className="text-xs">
          {t("integrations.enabledCount", { count: enabledCount, total: integrations.length })}
        </Badge>
      </section>

      <p className="text-muted-foreground bg-muted/50 border-border rounded-xl border px-4 py-3 text-xs leading-relaxed">
        {t("integrations.placeholderNotice")}
      </p>

      <div className="flex flex-col gap-6">
        {grouped.map(({ group, items }) => {
          const GroupIcon = GROUP_ICON[group];
          return (
            <section key={group} className="flex flex-col gap-3">
              <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                <GroupIcon className="size-3.5" />
                {t(`integrations.groups.${group}`)}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <article
                    key={item.key}
                    className="bg-card shadow-soft border-border flex flex-col gap-3 rounded-2xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <h4 className="text-foreground text-sm font-semibold">{t(`integrations.keys.${item.key}`)}</h4>
                        <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                          {item.key}
                        </span>
                      </div>
                      {item.enabled ? (
                        <Badge tone="success">
                          <CheckCircle2 className="size-3" />
                          {t("integrations.enabled")}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">
                          <CircleDashed className="size-3" />
                          {t("integrations.disabled")}
                        </Badge>
                      )}
                    </div>

                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-muted-foreground">{t("integrations.apiKey")}</dt>
                      <dd className="text-foreground text-end font-medium">
                        {item.hasApiKey ? t("integrations.configured") : t("integrations.notConfigured")}
                      </dd>
                      <dt className="text-muted-foreground">{t("integrations.secret")}</dt>
                      <dd className="text-foreground text-end font-medium">
                        {item.hasSecret ? t("integrations.configured") : t("integrations.notConfigured")}
                      </dd>
                      <dt className="text-muted-foreground">{t("integrations.updated")}</dt>
                      <dd className="text-foreground text-end font-medium tabular-nums">
                        {dateFmt.format(item.updatedAt)}
                      </dd>
                    </dl>

                    {item.note && <p className="text-muted-foreground text-xs leading-relaxed">{item.note}</p>}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
