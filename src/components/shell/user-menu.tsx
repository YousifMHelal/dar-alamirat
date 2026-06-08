"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

/**
 * User-menu placeholder. No real auth yet (later phase) — this just
 * presents an account chip with avatar initials, name, and role. The
 * trigger is a button so it's keyboard-focusable and ready to host a
 * dropdown once auth lands.
 */
export function UserMenu() {
  const t = useTranslations("user");

  return (
    <button
      type="button"
      aria-label={t("menu")}
      className="hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-background flex items-center gap-2.5 rounded-full py-1 ps-1 pe-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
        {t("name").charAt(0)}
      </span>
      <span className="hidden flex-col items-start text-start sm:flex">
        <span className="text-sm leading-tight font-medium">{t("name")}</span>
        <span className="text-muted-foreground text-xs leading-tight">
          {t("role")}
        </span>
      </span>
      <ChevronDown className="text-muted-foreground hidden size-4 sm:block" />
    </button>
  );
}
