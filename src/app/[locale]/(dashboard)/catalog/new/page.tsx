import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listCategories, listPricingTiers } from "@/lib/catalog/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { ProductForm } from "@/components/catalog/product-form";

const MODULE_KEY = "catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("form.createTitle") };
}

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "catalog" });
  const [categories, tiers] = await Promise.all([listCategories(), listPricingTiers()]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/catalog"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToCatalog")}
      </Link>

      <CatalogHeader title={t("form.createTitle")} subtitle={t("form.createSubtitle")} />

      <ProductForm
        locale={locale}
        categories={categories}
        tiers={tiers.map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
