"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { modules, type ModuleKey } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

/**
 * The module nav list, shared by the desktop sidebar and the mobile
 * drawer. Active state is derived from the locale-stripped pathname.
 * Spacing/alignment use logical properties so the list mirrors in RTL.
 *
 * `moduleKeys` is the role-filtered allow-list computed server-side; only
 * those modules render. This is the "hide what you can't reach" half of
 * RBAC — the server-side route guard is the enforcing half.
 */
export function NavLinks({
  moduleKeys,
  onNavigate,
}: {
  moduleKeys: readonly ModuleKey[];
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  const allowed = new Set(moduleKeys);
  const visibleModules = modules.filter((m) => allowed.has(m.key));

  return (
    <nav
      aria-label={t("sectionMain")}
      className="flex flex-col gap-1 px-3 py-4"
    >
      {!collapsed && (
        <span className="text-sidebar-muted px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase">
          {t("sectionMain")}
        </span>
      )}

      {visibleModules.map(({ key, href, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={key}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            title={collapsed ? t(key) : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
              "focus-visible:ring-ring focus-visible:ring-offset-sidebar outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              collapsed && "justify-center",
              isActive
                ? "bg-sidebar-active text-sidebar-active-foreground"
                : "text-sidebar-foreground hover:bg-muted",
            )}
          >
            {/* Active indicator pinned to the start edge (mirrors in RTL). */}
            <span
              aria-hidden
              className={cn(
                "bg-primary absolute start-0 h-5 w-1 rounded-e-full transition-opacity",
                isActive ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon
              className={cn(
                "size-5 shrink-0 transition-colors",
                isActive
                  ? "text-sidebar-active-foreground"
                  : "text-sidebar-muted group-hover:text-foreground",
              )}
            />
            {!collapsed && <span className="truncate">{t(key)}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
