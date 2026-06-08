import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sparkles } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Brand } from "@/components/shell/brand";
import { LanguageToggle } from "@/components/shell/language-toggle";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("title") };
}

/**
 * Login page — sits outside the (dashboard) group, so no sidebar/topbar.
 * A two-column editorial layout: a brand/marketing panel on the start side
 * (collapses on mobile) and the sign-in card on the end side. Direction,
 * fonts, and messages all come from the locale layout, so it mirrors fully
 * for RTL with no per-element overrides.
 */
export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <div className="bg-background flex min-h-dvh flex-col lg:flex-row">
      {/* Form panel */}
      <main className="flex flex-1 flex-col px-6 py-10 sm:px-10">
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <div className="lg:hidden">
            <Brand />
          </div>
          <LanguageToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col gap-2 text-start">
              <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight">
                {t("title")}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("subtitle")}
              </p>
            </div>

            <div className="bg-card shadow-soft border-border rounded-2xl border p-6 sm:p-8">
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
