import {
  Activity,
  Bell,
  Boxes,
  FileSpreadsheet,
  FolderOpen,
  LayoutGrid,
  LayoutPanelLeft,
  LifeBuoy,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tag,
  TicketCheck,
  Truck,
  BarChart3,
  Users,
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
  { key: "abandonedCarts", href: "/abandoned-carts", icon: ShoppingCart },
  { key: "catalog", href: "/catalog", icon: ShoppingBag },
  { key: "categories", href: "/catalog/categories", icon: FolderOpen },
  { key: "importExport", href: "/catalog/import-export", icon: FileSpreadsheet },
  { key: "inventory", href: "/inventory", icon: Boxes },
  // Marketing
  { key: "content", href: "/content", icon: LayoutPanelLeft },
  { key: "seo", href: "/seo", icon: Search },
  { key: "coupons", href: "/coupons", icon: Tag },
  { key: "loyalty", href: "/loyalty", icon: Gift },
  { key: "giftCards", href: "/gift-cards", icon: TicketCheck },
  // Finance
  { key: "financials", href: "/financials", icon: Receipt },
  { key: "reports", href: "/reports", icon: BarChart3 },
  { key: "performance", href: "/performance", icon: Activity },
  // Admin
  { key: "customers", href: "/customers", icon: Users },
  { key: "staff", href: "/staff", icon: UserCog },
  { key: "shipping", href: "/shipping", icon: MapPin },
  { key: "reviews", href: "/reviews", icon: Star },
  { key: "notifications", href: "/notifications", icon: Bell },
  { key: "support", href: "/support", icon: LifeBuoy },
  { key: "settings", href: "/settings", icon: Settings },
] as const satisfies readonly PortalModule[];

export const navSections = [
  {
    key: "overview",
    modules: ["overview"],
  },
  {
    key: "orders",
    modules: ["orders", "abandonedCarts", "shipping"],
  },
  {
    key: "catalog",
    modules: ["catalog", "categories", "inventory", "importExport"],
  },
  {
    key: "marketing",
    modules: ["content", "seo", "coupons", "loyalty", "giftCards"],
  },
  {
    key: "customers",
    modules: ["customers", "reviews", "support"],
  },
  {
    key: "finance",
    modules: ["financials", "reports", "performance"],
  },
  {
    key: "system",
    modules: ["staff", "notifications", "settings"],
  },
] as const;

export type ModuleKey =
  | "overview"
  | "orders"
  | "abandonedCarts"
  | "catalog"
  | "categories"
  | "importExport"
  | "inventory"
  | "content"
  | "seo"
  | "coupons"
  | "loyalty"
  | "giftCards"
  | "financials"
  | "reports"
  | "performance"
  | "customers"
  | "staff"
  | "shipping"
  | "reviews"
  | "notifications"
  | "support"
  | "settings";

export function getModule(key: ModuleKey): PortalModule | undefined {
  return modules.find((m) => m.key === key);
}
