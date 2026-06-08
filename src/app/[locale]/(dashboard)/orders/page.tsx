import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { ModulePage } from "@/components/module-page";
import { requireModuleAccess } from "@/lib/auth/guard";

const MODULE_KEY = "orders";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "modules" });
  return { title: t(`${MODULE_KEY}.title`) };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Server-side RBAC: blocks roles that lack this module even via direct URL.
  await requireModuleAccess(MODULE_KEY, locale);
  return <ModulePage moduleKey={MODULE_KEY} />;
}
