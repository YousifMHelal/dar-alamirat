import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getCategoryDetail } from "@/lib/catalog/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { CategoryForm } from "@/components/catalog/category-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const [t, category] = await Promise.all([
    getTranslations({ locale, namespace: "categories" }),
    getCategoryDetail(id),
  ]);
  return {
    title: category
      ? `${t("form.editTitle")} — ${category.nameEn}`
      : t("form.editTitle"),
  };
}

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess("categories", locale);

  const [t, category] = await Promise.all([
    getTranslations({ locale, namespace: "categories" }),
    getCategoryDetail(id),
  ]);

  if (!category) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/catalog/categories"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToCategories")}
      </Link>

      <CatalogHeader
        title={t("form.editTitle")}
        subtitle={`${category.nameEn} · ${category.nameAr}`}
      />

      <CategoryForm category={category} />
    </div>
  );
}
