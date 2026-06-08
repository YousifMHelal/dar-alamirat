import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** `/[locale]` has no landing page of its own — send users to Overview. */
export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  redirect({ href: "/overview", locale });
}
