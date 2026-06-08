import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Search } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getProductSeo } from "@/lib/seo/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { MetaEditor } from "@/components/seo/meta-editor";

const MODULE_KEY = "seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return { title: t("title") };
}

export default async function SeoEditPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const t = await getTranslations({ locale, namespace: "seo" });
  const product = await getProductSeo(id);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={t("title")} subtitle={t("subtitle")} icon={Search} />
      <MetaEditor locale={locale} product={product} />
    </div>
  );
}
