import {
  Boxes,
  LayoutGrid,
  LayoutPanelLeft,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";

/**
 * The 8 portal modules — single source of truth for navigation and
 * routing. `key` maps into the message catalog (nav.<key>,
 * modules.<key>.*) so every label is bilingual, and `href` is the
 * locale-relative route under app/[locale].
 */
export interface PortalModule {
  key: ModuleKey;
  href: string;
  icon: LucideIcon;
}

export const modules = [
  { key: "overview", href: "/overview", icon: LayoutGrid },
  { key: "content", href: "/content", icon: LayoutPanelLeft },
  { key: "catalog", href: "/catalog", icon: ShoppingBag },
  { key: "inventory", href: "/inventory", icon: Boxes },
  { key: "orders", href: "/orders", icon: Truck },
  { key: "seo", href: "/seo", icon: Search },
  { key: "financials", href: "/financials", icon: Receipt },
  { key: "settings", href: "/settings", icon: Settings },
] as const satisfies readonly PortalModule[];

/** Union of valid module route keys — also the nav/modules message keys. */
export type ModuleKey =
  | "overview"
  | "content"
  | "catalog"
  | "inventory"
  | "orders"
  | "seo"
  | "financials"
  | "settings";

/** Look up a module definition by its route key. */
export function getModule(key: ModuleKey): PortalModule | undefined {
  return modules.find((m) => m.key === key);
}
