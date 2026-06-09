import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Megaphone } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { CatalogHeader } from "@/components/catalog/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "campaigns" });
  return { title: t("form.createTitle") };
}

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess("campaigns", locale);

  const t = await getTranslations({ locale, namespace: "campaigns" });

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        title={t("form.createTitle")}
        subtitle={t("form.createSubtitle")}
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
      <CampaignForm locale={locale} />
    </div>
  );
}
