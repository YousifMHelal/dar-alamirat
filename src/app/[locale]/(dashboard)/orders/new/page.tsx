import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getDirection } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listPricingTiers } from "@/lib/orders/actions";
import { NewOrderForm } from "@/components/orders/new-order-form";

const MODULE_KEY = "orders";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orders" });
  return { title: t("form.title") };
}

export default async function NewOrderPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "orders" });
  const tiers = await listPricingTiers();
  const BackIcon = getDirection(locale) === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/orders"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm transition-colors"
      >
        <BackIcon className="size-4" />
        {t("backToOrders")}
      </Link>

      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("form.title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          {t("form.subtitle")}
        </p>
      </header>

      <NewOrderForm locale={locale} tiers={tiers} />
    </div>
  );
}
