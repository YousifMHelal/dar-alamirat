import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LayoutPanelLeft } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import {
  getBanners,
  getAppLayout,
  listCategoriesForLayout,
} from "@/lib/content/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { BannerEditor } from "@/components/content/banner-editor";
import { LayoutBuilder } from "@/components/content/layout-builder";

const MODULE_KEY = "content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "content" });
  return { title: t("title") };
}

export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "content" });
  const tab = sp.tab === "layout" ? "layout" : "banners";

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={t("title")} subtitle={t("subtitle")} icon={LayoutPanelLeft} />

      <div className="border-border flex gap-1 border-b">
        <TabLink href="/content?tab=banners" active={tab === "banners"} label={t("tabs.banners")} />
        <TabLink href="/content?tab=layout" active={tab === "layout"} label={t("tabs.layout")} />
      </div>

      {tab === "banners" ? (
        <BannerEditor initial={await getBanners()} />
      ) : (
        <LayoutBuilder
          locale={locale}
          initial={await getAppLayout()}
          categories={await listCategoriesForLayout()}
        />
      )}
    </div>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground border-transparent"
      }`}
    >
      {label}
    </Link>
  );
}
