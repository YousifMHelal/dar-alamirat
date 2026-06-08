import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Upload } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { CatalogHeader } from "@/components/catalog/page-header";
import { ImportForm } from "@/components/catalog/import-form";

const MODULE_KEY = "catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("importPage.title") };
}

export default async function ImportCatalogPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "catalog" });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/catalog"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToCatalog")}
      </Link>

      <CatalogHeader title={t("importPage.title")} subtitle={t("importPage.subtitle")} icon={Upload} />

      <ImportForm locale={locale} />
    </div>
  );
}
