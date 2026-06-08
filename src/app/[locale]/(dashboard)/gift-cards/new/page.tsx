import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Gift } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listCustomersForSelect } from "@/lib/gift-cards/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { GiftCardForm } from "@/components/gift-cards/gift-card-form";

const MODULE_KEY = "giftCards";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "giftCards" });
  return { title: t("form.createTitle") };
}

export default async function NewGiftCardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const [t, customers] = await Promise.all([
    getTranslations({ locale, namespace: "giftCards" }),
    listCustomersForSelect(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/gift-cards" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToGiftCards")}
      </Link>

      <CatalogHeader title={t("form.createTitle")} subtitle={t("form.createSubtitle")} icon={Gift} />

      <GiftCardForm customers={customers} />
    </div>
  );
}
