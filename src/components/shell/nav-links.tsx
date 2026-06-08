"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { modules, navSections, type ModuleKey } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

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
  const moduleMap = new Map(modules.map((m) => [m.key, m]));

  // All hrefs sorted longest-first so the most-specific match wins.
  // This prevents /catalog from being active when /catalog/categories is current.
  const allHrefs = modules.map((m) => m.href).sort((a, b) => b.length - a.length);
  const bestMatch = allHrefs.find(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );

  return (
    <nav aria-label={t("sectionMain")} className="flex flex-col gap-4 px-3 py-4">
      {navSections.map((section) => {
        const visibleModules = section.modules
          .map((key) => moduleMap.get(key))
          .filter((m) => m && allowed.has(m.key)) as (typeof modules)[number][];

        if (visibleModules.length === 0) return null;

        return (
          <div key={section.key} className="flex flex-col gap-0.5">
            {!collapsed && (
              <span className="text-sidebar-muted px-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase">
                {t(`section_${section.key}`)}
              </span>
            )}
            {collapsed && (
              <div className="border-sidebar-border mx-auto mb-1 w-6 border-t" />
            )}

            {visibleModules.map(({ key, href, icon: Icon }) => {
              const isActive = href === bestMatch;

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
          </div>
        );
      })}
    </nav>
  );
}
