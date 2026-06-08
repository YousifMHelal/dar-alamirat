import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import { getCouponDetail } from "@/lib/coupons/queries";
import { CatalogHeader } from "@/components/catalog/page-header";
import { CouponForm } from "@/components/coupons/coupon-form";

const MODULE_KEY = "coupons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const [t, coupon] = await Promise.all([
    getTranslations({ locale, namespace: "coupons" }),
    getCouponDetail(id),
  ]);
  return {
    title: coupon ? `${t("form.editTitle")} — ${coupon.code}` : t("form.editTitle"),
  };
}

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const [t, coupon] = await Promise.all([
    getTranslations({ locale, namespace: "coupons" }),
    getCouponDetail(id),
  ]);

  if (!coupon) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/coupons"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToCoupons")}
      </Link>

      <CatalogHeader title={t("form.editTitle")} subtitle={coupon.code} />

      <CouponForm coupon={coupon} />
    </div>
  );
}
