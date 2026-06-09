import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sparkles } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { requireModuleAccess } from "@/lib/auth/guard";
import { CatalogHeader } from "@/components/catalog/page-header";
import { ShadeFinderQuiz } from "@/components/shade-finder/shade-finder-quiz";

const MODULE_KEY = "shadeFinder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shadeFinder" });
  return { title: t("title") };
}

export default async function ShadeFinderPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "shadeFinder" });

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={Sparkles}
      />
      <ShadeFinderQuiz locale={locale} />
    </div>
  );
}
