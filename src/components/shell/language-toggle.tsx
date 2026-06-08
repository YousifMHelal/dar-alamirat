"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * AR/EN language toggle. Re-navigates to the same pathname under the
 * other locale via next-intl's locale-aware router, which flips the URL
 * prefix; the locale layout then re-renders with the new `dir`, fonts,
 * and messages — mirroring the whole layout live with no reload.
 */
export function LanguageToggle() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const next = locale === "ar" ? "en" : "ar";

  function switchLocale() {
    startTransition(() => {
      // Re-push the current route under the target locale, preserving any
      // dynamic params on the path.
      router.replace(
        // @ts-expect-error -- pathname is a known route string at runtime
        { pathname, params },
        { locale: next },
      );
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={switchLocale}
      disabled={isPending}
      aria-label={t("label")}
      className="gap-1.5"
    >
      <Languages className="size-4" />
      <span className="text-xs font-semibold tracking-wide">
        {t("switchTo")}
      </span>
    </Button>
  );
}
