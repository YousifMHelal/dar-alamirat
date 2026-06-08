import {
  Boxes,
  FolderOpen,
  LayoutGrid,
  LayoutPanelLeft,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  Truck,
  BarChart3,
  Users,
  Tag,
  Gift,
  UserCog,
  MapPin,
  Star,
  type LucideIcon,
} from "lucide-react";

export interface PortalModule {
  key: ModuleKey;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  key: string;
  modules: readonly PortalModule[];
}

export const modules = [
  // Store
  { key: "overview", href: "/overview", icon: LayoutGrid },
  { key: "orders", href: "/orders", icon: Truck },
  { key: "catalog", href: "/catalog", icon: ShoppingBag },
  { key: "categories", href: "/catalog/categories", icon: FolderOpen },
  { key: "inventory", href: "/inventory", icon: Boxes },
  // Marketing
  { key: "content", href: "/content", icon: LayoutPanelLeft },
  { key: "seo", href: "/seo", icon: Search },
  { key: "coupons", href: "/coupons", icon: Tag },
  { key: "loyalty", href: "/loyalty", icon: Gift },
  // Finance
  { key: "financials", href: "/financials", icon: Receipt },
  { key: "reports", href: "/reports", icon: BarChart3 },
  // Admin
  { key: "customers", href: "/customers", icon: Users },
  { key: "staff", href: "/staff", icon: UserCog },
  { key: "shipping", href: "/shipping", icon: MapPin },
  { key: "reviews", href: "/reviews", icon: Star },
  { key: "settings", href: "/settings", icon: Settings },
] as const satisfies readonly PortalModule[];

export const navSections = [
  {
    key: "store",
    modules: ["overview", "orders", "catalog", "categories", "inventory"],
  },
  {
    key: "marketing",
    modules: ["content", "seo", "coupons", "loyalty"],
  },
  {
    key: "finance",
    modules: ["financials", "reports"],
  },
  {
    key: "admin",
    modules: ["customers", "staff", "shipping", "reviews", "settings"],
  },
] as const;

export type ModuleKey =
  | "overview"
  | "orders"
  | "catalog"
  | "categories"
  | "inventory"
  | "content"
  | "seo"
  | "coupons"
  | "loyalty"
  | "financials"
  | "reports"
  | "customers"
  | "staff"
  | "shipping"
  | "reviews"
  | "settings";

export function getModule(key: ModuleKey): PortalModule | undefined {
  return modules.find((m) => m.key === key);
}
