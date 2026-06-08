import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Use these `Link`, `redirect`,
 * `usePathname`, `useRouter` instead of the next/navigation ones so the
 * active `[locale]` prefix is preserved automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
