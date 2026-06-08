import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus, FolderOpen, ImageOff } from "lucide-react";
import Image from "next/image";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { listCategoriesDetail } from "@/lib/catalog/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "categories" });
  return { title: t("title") };
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess("categories", locale);

  const t = await getTranslations({ locale, namespace: "categories" });
  const categories = await listCategoriesDetail();

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link href="/catalog/categories/new">
            <Button>
              <Plus />
              {t("newCategory")}
            </Button>
          </Link>
        }
      />

      {categories.length === 0 ? (
        <section className="bg-card shadow-soft border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center">
          <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl">
            <FolderOpen className="size-6" />
          </span>
          <h2 className="font-display text-foreground text-xl font-semibold">
            {t("empty.title")}
          </h2>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
            {t("empty.body")}
          </p>
          <Link href="/catalog/categories/new">
            <Button>
              <Plus />
              {t("newCategory")}
            </Button>
          </Link>
        </section>
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("table.image")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.name")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("table.slug")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("table.products")}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr
                    key={c.id}
                    className="border-border hover:bg-muted/50 group border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="border-border bg-surface-muted/40 flex size-10 items-center justify-center overflow-hidden rounded-lg border">
                        {c.imageUrl ? (
                          <Image
                            src={c.imageUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="size-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <ImageOff className="text-muted-foreground size-4" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/catalog/categories/${c.id}`}
                        className="text-foreground hover:text-primary font-medium underline-offset-4 group-hover:underline"
                      >
                        {locale === "ar" ? c.nameAr : c.nameEn}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {locale === "ar" ? c.nameEn : c.nameAr}
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {c.slug}
                    </td>
                    <td className="text-foreground px-4 py-3 text-end tabular-nums">
                      {c.productCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
