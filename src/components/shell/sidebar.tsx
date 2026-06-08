"use client";

import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/lib/modules";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { useSidebar } from "./sidebar-context";

/**
 * Desktop sidebar — sits on the start side (right in AR, left in EN)
 * automatically because it's the first flex child and uses logical
 * borders. Collapses to an icons-only rail via the toggle. Hidden below
 * lg, where the mobile drawer takes over.
 */
export function Sidebar({ moduleKeys }: { moduleKeys: readonly ModuleKey[] }) {
  const t = useTranslations("shell");
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border hidden shrink-0 border-e lg:flex lg:flex-col",
        "sticky top-0 h-dvh",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[76px]" : "w-72",
      )}
    >
      <div
        className={cn(
          "border-sidebar-border flex h-16 items-center border-b px-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        <Brand compact={collapsed} />
      </div>

      <div className="scrollbar-subtle flex-1 overflow-y-auto">
        <NavLinks moduleKeys={moduleKeys} />
      </div>

      <div className="border-sidebar-border border-t p-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          className={cn(
            "text-sidebar-muted hover:bg-muted hover:text-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "focus-visible:ring-ring focus-visible:ring-offset-sidebar outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            collapsed && "justify-center",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5 shrink-0 rtl:scale-x-[-1]" />
          ) : (
            <PanelLeftClose className="size-5 shrink-0 rtl:scale-x-[-1]" />
          )}
          {!collapsed && <span>{t("collapseSidebar")}</span>}
        </button>
      </div>
    </aside>
  );
}
