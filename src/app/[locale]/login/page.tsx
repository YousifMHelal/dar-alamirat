import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import logo from "@/logo.avif";
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

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  const isAr = locale === "ar";

  return (
    <div className="bg-background relative flex min-h-dvh flex-col">
      {/* Subtle background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="border-primary/6 absolute -top-40 -inset-e-40 h-150 w-150 rounded-full border" />
        <div className="border-accent/8 absolute -bottom-32 -inset-s-32 h-100 w-100 rounded-full border" />
      </div>

      {/* Language toggle */}
      <div className="relative flex justify-end p-4 sm:p-6">
        <LanguageToggle />
      </div>

      {/* Centered content */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          {/* Logo + brand */}
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <div className="shadow-elevated flex size-16 items-center justify-center rounded-2xl bg-white ring-1 ring-black/5">
              <Image
                src={logo}
                alt="Dar Al-Amirat"
                width={44}
                height={44}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">
                {isAr ? "دار الأميرات" : "Dar Al-Amirat"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t("subtitle")}
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-card shadow-elevated border-border rounded-2xl border p-6 sm:p-8">
            <p className="text-foreground mb-6 text-base font-medium">
              {t("title")}
            </p>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>

          {/* Footer */}
          <p className="text-muted-foreground/60 mt-6 text-center text-xs">
            {isAr ? "© ٢٠٢٦ دار الأميرات" : "© 2026 Dar Al-Amirat"}
          </p>
        </div>
      </main>
    </div>
  );
}
