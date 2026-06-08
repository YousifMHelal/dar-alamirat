"use client";

import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { LanguageToggle } from "./language-toggle";
import { UserMenu } from "./user-menu";
import { useSidebar } from "./sidebar-context";

/**
 * Topbar — sticky header with the mobile menu trigger, brand area
 * (provided by the sidebar on desktop), the AR/EN toggle, and the user
 * menu. All horizontal layout uses flex + logical spacing so it mirrors
 * correctly in RTL.
 */
export function Topbar() {
  const t = useTranslations("shell");
  const { setMobileOpen } = useSidebar();

  return (
    <header className="bg-background/80 border-border sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={t("openMenu")}
          className="text-foreground hover:bg-muted focus-visible:ring-ring flex size-10 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 lg:hidden"
        >
          <Menu className="size-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LanguageToggle />
        <span className="bg-border hidden h-6 w-px sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
