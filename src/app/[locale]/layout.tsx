import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { inter, playfair, plexArabic } from "@/lib/fonts";
import { getDirection, routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/toast";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dar Al-Amirat — Operations Portal",
    template: "%s · Dar Al-Amirat",
  },
  description:
    "Enterprise operations portal for Dar Al-Amirat — analytics, catalog, inventory, orders, and more.",
};

/** Pre-render both locales at build time. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Guard against unsupported locales reaching the layout.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  const dir = getDirection(locale);
  // In Arabic the Arabic face must lead the stack; in English, Inter does.
  // Both font variables are always attached so fallbacks resolve cleanly.
  const fontVars = cn(
    inter.variable,
    plexArabic.variable,
    playfair.variable,
    locale === "ar"
      ? "[--font-latin:var(--font-plex-arabic)] [--font-arabic:var(--font-plex-arabic)]"
      : "[--font-latin:var(--font-inter)] [--font-arabic:var(--font-plex-arabic)]",
  );

  return (
    <html lang={locale} dir={dir} className={fontVars} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
