import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getCampaignDetail } from "@/lib/campaigns/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "campaigns" });
  const detail = await getCampaignDetail(id);
  return {
    title: detail
      ? `${locale === "ar" ? detail.nameAr : detail.nameEn} — ${t("form.editTitle")}`
      : t("form.editTitle"),
  };
}

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess("campaigns", locale);

  const detail = await getCampaignDetail(id);
  if (!detail) notFound();

  const t = await getTranslations({ locale, namespace: "campaigns" });

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={locale === "ar" ? detail.nameAr : detail.nameEn}
        subtitle={t("form.editSubtitle")}
        icon={Megaphone}
        action={
          <Link
            href="/campaigns"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" />
            {t("backToCampaigns")}
          </Link>
        }
      />
      <CampaignForm locale={locale} detail={detail} />
    </div>
  );
}
