import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import {
  getProductDetail,
  listCategories,
  listPricingTiers,
  getProductLinks,
} from "@/lib/catalog/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { ProductForm } from "@/components/catalog/product-form";
import { ProductLinksEditor } from "@/components/catalog/product-links-editor";

const MODULE_KEY = "catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("form.editTitle") };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "catalog" });
  const [product, categories, tiers, links] = await Promise.all([
    getProductDetail(id),
    listCategories(),
    listPricingTiers(),
    getProductLinks(id),
  ]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/catalog"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToCatalog")}
      </Link>

      <CatalogHeader
        title={locale === "ar" ? product.nameAr : product.nameEn}
        subtitle={t("form.editSubtitle")}
      />

      <ProductForm
        locale={locale}
        product={product}
        categories={categories}
        tiers={tiers.map((t) => ({ id: t.id, name: t.name }))}
      />

      <ProductLinksEditor
        productId={product.id}
        locale={locale}
        crossSell={links.crossSell}
        upSell={links.upSell}
      />
    </div>
  );
}
