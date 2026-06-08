import { defineRouting } from "next-intl/routing";

/**
 * Locale routing config. Arabic is the DEFAULT locale and English the
 * toggle. `localePrefix: "always"` keeps the `[locale]` segment in every
 * URL (so `/` resolves through the default locale to `/ar/...`).
 */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** Text direction for a given locale — the single source for RTL/LTR. */
export function getDirection(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
