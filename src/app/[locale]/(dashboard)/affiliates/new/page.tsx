import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { CatalogHeader } from "@/components/catalog/page-header";
import { AffiliateForm } from "@/components/affiliates/affiliate-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "affiliates" });
  return { title: t("form.createTitle") };
}

export default async function NewAffiliatePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess("affiliates", locale);

  const t = await getTranslations({ locale, namespace: "affiliates" });

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("form.createTitle")}
        subtitle={t("form.createSubtitle")}
        icon={Sparkles}
        action={
          <Link
            href="/affiliates"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" />
            {t("backToAffiliates")}
          </Link>
        }
      />
      <AffiliateForm locale={locale} />
    </div>
  );
}
