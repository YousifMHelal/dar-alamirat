import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Boxes, Layers, TriangleAlert, Warehouse as WarehouseIcon } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireModuleAccess } from "@/lib/auth/guard";
import {
  getStockMatrix,
  countLowStock,
  listWarehouses,
  listTransfers,
  listPurchaseOrders,
  type PurchaseOrderRow,
} from "@/lib/inventory/queries";
import { prisma } from "@/lib/prisma";
import { formatNumber, formatSar } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { CatalogHeader } from "@/components/catalog/page-header";
import { MatrixToolbar } from "@/components/inventory/matrix-toolbar";
import { StockCellEditor } from "@/components/inventory/stock-cell";
import { TransfersPanel } from "@/components/inventory/transfers-panel";

const MODULE_KEY = "inventory";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inventory" });
  return { title: t("title") };
}

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tab?: string; q?: string; low?: string; wh?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireModuleAccess(MODULE_KEY, locale);

  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "inventory" });
  const tab =
    sp.tab === "transfers" ? "transfers" : sp.tab === "po" ? "po" : "matrix";

  const search = sp.q ?? "";
  const lowStockOnly = sp.low === "1";
  const warehouseId = sp.wh || undefined;
  const page = Number(sp.page) || 1;

  // KPI strip data — shared across both tabs.
  const [warehouses, lowStockTotal, variantCount, unitsAgg] = await Promise.all([
    listWarehouses(),
    countLowStock(),
    prisma.productVariant.count(),
    prisma.inventoryItem.aggregate({ _sum: { quantityOnHand: true } }),
  ]);
  const totalUnits = unitsAgg._sum.quantityOnHand ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader title={t("title")} subtitle={t("subtitle")} icon={Boxes} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={Layers} label={t("kpi.variants")} value={formatNumber(variantCount, locale)} tone="info" />
        <Kpi icon={Boxes} label={t("kpi.totalUnits")} value={formatNumber(totalUnits, locale)} tone="primary" />
        <Kpi
          icon={TriangleAlert}
          label={t("kpi.lowStock")}
          value={formatNumber(lowStockTotal, locale)}
          tone={lowStockTotal > 0 ? "danger" : "success"}
        />
        <Kpi icon={WarehouseIcon} label={t("kpi.warehouses")} value={formatNumber(warehouses.length, locale)} tone="accent" />
      </div>

      <div className="border-border flex gap-1 border-b">
        <TabLink href="/inventory?tab=matrix" active={tab === "matrix"} label={t("tabs.matrix")} />
        <TabLink href="/inventory?tab=transfers" active={tab === "transfers"} label={t("tabs.transfers")} />
        <TabLink href="/inventory?tab=po" active={tab === "po"} label={t("tabs.purchaseOrders")} />
      </div>

      {tab === "matrix" && (
        <MatrixTab
          locale={locale}
          search={search}
          lowStockOnly={lowStockOnly}
          warehouseId={warehouseId}
          page={page}
          rawStatus={sp}
        />
      )}
      {tab === "transfers" && (
        <TransfersPanel locale={locale} warehouses={warehouses} transfers={await listTransfers()} />
      )}
      {tab === "po" && <PurchaseOrdersTab locale={locale} rows={await listPurchaseOrders()} />}
    </div>
  );
}

async function MatrixTab({
  locale,
  search,
  lowStockOnly,
  warehouseId,
  page,
  rawStatus,
}: {
  locale: Locale;
  search: string;
  lowStockOnly: boolean;
  warehouseId?: string;
  page: number;
  rawStatus: { q?: string; low?: string; wh?: string };
}) {
  const t = await getTranslations({ locale, namespace: "inventory.matrix" });
  const { warehouses, rows, total, pageCount } = await getStockMatrix({
    search,
    lowStockOnly,
    warehouseId,
    page,
  });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("tab", "matrix");
    if (rawStatus.q) params.set("q", rawStatus.q);
    if (rawStatus.low) params.set("low", rawStatus.low);
    if (rawStatus.wh) params.set("wh", rawStatus.wh);
    if (p > 1) params.set("page", String(p));
    return `/inventory?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <MatrixToolbar
        initialSearch={search}
        initialLow={lowStockOnly}
        initialWarehouse={warehouseId ?? ""}
        warehouses={warehouses}
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-240 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("variant")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("barcode")}</th>
                  {warehouses.map((w) => (
                    <th key={w.id} className="px-4 py-3 text-end font-semibold">
                      <span className="text-foreground">{w.code}</span>
                      <span className="text-muted-foreground block text-[10px] font-normal normal-case">
                        {w.city}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-end font-semibold">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.variantId}
                    className={`border-border border-b transition-colors last:border-0 ${
                      row.anyLow ? "bg-destructive/3" : "hover:bg-muted/40"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.colorHex && (
                          <span
                            className="border-border size-3.5 shrink-0 rounded-full border"
                            style={{ backgroundColor: row.colorHex }}
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0">
                          <div className="text-foreground truncate font-medium">
                            {locale === "ar" ? row.productName.ar : row.productName.en}
                          </div>
                          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <span className="font-mono">{row.variantSku}</span>
                            {row.capacity && <span>· {row.capacity}</span>}
                            {row.colorName && <span>· {row.colorName}</span>}
                            {row.anyLow && (
                              <span className="bg-destructive/12 text-destructive inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                                <TriangleAlert className="size-2.5" />
                                {t("lowBadge")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Barcode column — supports stocktake auditing. */}
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs tabular-nums" dir="ltr">
                      {row.barcode ?? "—"}
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.warehouseId} className="px-2 py-3 text-end">
                        <StockCellEditor
                          locale={locale}
                          variantId={row.variantId}
                          warehouseId={cell.warehouseId}
                          cell={cell}
                        />
                      </td>
                    ))}
                    <td className="text-foreground px-4 py-3 text-end font-semibold tabular-nums">
                      {formatNumber(row.totalStock, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border flex items-center justify-between gap-4 border-t px-4 py-3">
            <p className="text-muted-foreground text-xs tabular-nums">{`${rows.length} / ${total}`}</p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">{`${page} / ${pageCount}`}</span>
              <PagerLink href={pageHref(page - 1)} disabled={page <= 1} label="‹" />
              <PagerLink href={pageHref(page + 1)} disabled={page >= pageCount} label="›" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function PurchaseOrdersTab({
  locale,
  rows,
}: {
  locale: Locale;
  rows: PurchaseOrderRow[];
}) {
  const t = await getTranslations({ locale, namespace: "inventory.po" });
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const tone: Record<string, "neutral" | "info" | "success" | "danger"> = {
    DRAFT: "neutral",
    ORDERED: "info",
    RECEIVED: "success",
    CANCELLED: "danger",
  };

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
      <div className="scrollbar-subtle overflow-x-auto">
        <table className="w-full min-w-220 border-collapse text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
              <th className="px-4 py-3 text-start font-semibold">{t("poNumber")}</th>
              <th className="px-4 py-3 text-start font-semibold">{t("supplier")}</th>
              <th className="px-4 py-3 text-start font-semibold">{t("warehouse")}</th>
              <th className="px-4 py-3 text-end font-semibold">{t("lines")}</th>
              <th className="px-4 py-3 text-end font-semibold">{t("units")}</th>
              <th className="px-4 py-3 text-end font-semibold">{t("total")}</th>
              <th className="px-4 py-3 text-start font-semibold">{t("status")}</th>
              <th className="px-4 py-3 text-end font-semibold">{t("expected")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((po) => (
              <tr key={po.id} className="border-border hover:bg-muted/40 border-b transition-colors last:border-0">
                <td className="text-foreground px-4 py-3 font-mono text-xs font-medium tabular-nums">
                  {po.poNumber}
                </td>
                <td className="text-foreground px-4 py-3">{po.supplier}</td>
                <td className="text-foreground px-4 py-3">{po.warehouse.name}</td>
                <td className="text-foreground px-4 py-3 text-end tabular-nums">
                  {formatNumber(po.lineCount, locale)}
                </td>
                <td className="text-foreground px-4 py-3 text-end tabular-nums">
                  {formatNumber(po.unitCount, locale)}
                </td>
                <td className="text-foreground px-4 py-3 text-end font-medium tabular-nums">
                  {formatSar(po.total, locale)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={tone[po.status]}>{t(`status_${po.status}`)}</Badge>
                </td>
                <td className="text-muted-foreground px-4 py-3 text-end tabular-nums">
                  {po.expectedAt ? dateFmt.format(po.expectedAt) : t("noDate")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  tone: "primary" | "accent" | "info" | "danger" | "success";
}) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent/15 text-accent-foreground",
    info: "bg-muted text-foreground",
    danger: "bg-destructive/12 text-destructive",
    success: "bg-success/12 text-success",
  };
  return (
    <article className="bg-card shadow-soft border-border flex items-center gap-3 rounded-2xl border p-4">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClass[tone]}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-foreground text-xl font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground truncate text-xs">{label}</p>
      </div>
    </article>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground border-transparent"
      }`}
    >
      {label}
    </Link>
  );
}

function PagerLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="border-border text-muted-foreground inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg border opacity-50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="border-border-strong bg-surface text-foreground hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
    >
      {label}
    </Link>
  );
}
