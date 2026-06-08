"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { useSidebar } from "./sidebar-context";

/**
 * Mobile navigation drawer. Slides in from the start edge (right in AR,
 * left in EN) via logical `start-0` positioning, with a dismiss scrim.
 * Shown only below lg, where the static sidebar is hidden.
 */
export function MobileDrawer() {
  const t = useTranslations("shell");
  const { mobileOpen, setMobileOpen } = useSidebar();

  // Lock body scroll and allow Escape to close while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen, setMobileOpen]);

  return (
    <div
      className={cn(
        "lg:hidden",
        mobileOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!mobileOpen}
    >
      {/* Scrim */}
      <div
        onClick={() => setMobileOpen(false)}
        className={cn(
          "bg-foreground/40 fixed inset-0 z-40 transition-opacity duration-300",
          mobileOpen ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("primaryNavigation")}
        className={cn(
          "bg-sidebar border-sidebar-border shadow-elevated fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col border-e",
          "transition-transform duration-300 ease-in-out",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="border-sidebar-border flex h-16 items-center justify-between border-b px-4">
          <Brand />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={t("closeMenu")}
            className="text-sidebar-muted hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="scrollbar-subtle flex-1 overflow-y-auto">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </div>
      </aside>
    </div>
  );
}
