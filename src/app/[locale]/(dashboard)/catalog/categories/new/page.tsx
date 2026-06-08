import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { CatalogHeader } from "@/components/catalog/page-header";
import { CategoryForm } from "@/components/catalog/category-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "categories" });
  return { title: t("form.createTitle") };
}

export default async function NewCategoryPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess("categories", locale);

  const t = await getTranslations({ locale, namespace: "categories" });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/catalog/categories"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToCategories")}
      </Link>

      <CatalogHeader title={t("form.createTitle")} subtitle={t("form.createSubtitle")} />

      <CategoryForm />
    </div>
  );
}
