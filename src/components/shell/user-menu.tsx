"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, LogOut } from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/**
 * Account menu — shows the real logged-in user (name + localized role) and
 * a working sign-out. The trigger opens a small dropdown; sign-out calls
 * the logout server action, which clears the JWT session and redirects to
 * the locale's /login. Closes on outside-click and Escape.
 */
export function UserMenu({
  user,
  locale,
}: {
  user: { name: string | null; email: string | null; role: Role };
  locale: string;
}) {
  const t = useTranslations("user");
  const tr = useTranslations("auth.roles");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const displayName = user.name ?? user.email ?? "";
  const roleLabel = tr(user.role);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function signOut() {
    startTransition(async () => {
      await logoutAction(`/${locale}/login`);
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("menu")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-background flex items-center gap-2.5 rounded-full py-1 ps-1 pe-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden flex-col items-start text-start sm:flex">
          <span className="text-sm leading-tight font-medium">
            {displayName}
          </span>
          <span className="text-muted-foreground text-xs leading-tight">
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground hidden size-4 transition-transform sm:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="bg-card shadow-elevated border-border absolute end-0 z-50 mt-2 w-60 origin-top overflow-hidden rounded-xl border"
        >
          {/* Identity header (also covers the mobile case where the chip hides it) */}
          <div className="border-border flex flex-col gap-0.5 border-b px-4 py-3">
            <span className="text-foreground truncate text-sm font-medium">
              {displayName}
            </span>
            {user.email && (
              <span className="text-muted-foreground truncate text-xs" dir="ltr">
                {user.email}
              </span>
            )}
            <span className="text-primary bg-primary-soft mt-1.5 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
              {roleLabel}
            </span>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={isPending}
            className="text-foreground hover:bg-muted flex w-full items-center gap-2.5 px-4 py-3 text-sm transition-colors outline-none disabled:opacity-50"
          >
            <LogOut className="text-muted-foreground size-4 rtl:scale-x-[-1]" />
            {isPending ? t("signingOut") : t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
