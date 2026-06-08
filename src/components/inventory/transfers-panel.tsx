"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  ArrowRight,
  Loader2,
  Search,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createTransfer,
  updateTransferStatus,
  searchVariantsForTransfer,
} from "@/lib/inventory/actions";
import type {
  TransferRow,
  TransferVariantOption,
  WarehouseColumn,
} from "@/lib/inventory/queries";

/**
 * Stock transfers: a create form (variant picker + from/to warehouses +
 * quantity + initial status) and a list of recent transfers with a
 * "mark completed" action. Creating/completing a transfer moves real units
 * server-side; the list refreshes on success.
 */

const ERROR_KEYS = [
  "quantityMin",
  "sameWarehouse",
  "insufficientStock",
  "notFound",
  "invalid",
  "unknown",
] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

type Status = "PENDING" | "IN_TRANSIT" | "COMPLETED";

const statusTone: Record<Status, "neutral" | "info" | "success"> = {
  PENDING: "neutral",
  IN_TRANSIT: "info",
  COMPLETED: "success",
};

export function TransfersPanel({
  locale,
  warehouses,
  transfers,
}: {
  locale: string;
  warehouses: WarehouseColumn[];
  transfers: TransferRow[];
}) {
  const t = useTranslations("inventory.transfers");
  const tErr = useTranslations("inventory.errors");
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const errKey = (e: string): ErrorKey =>
    (ERROR_KEYS as readonly string[]).includes(e) ? (e as ErrorKey) : "unknown";

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-foreground text-lg font-semibold">{t("title")}</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus />
            {t("new")}
          </Button>
        )}
      </div>

      {showForm && (
        <CreateTransferForm
          locale={locale}
          warehouses={warehouses}
          tErr={(e) => tErr(errKey(e))}
          onDone={() => {
            setShowForm(false);
            router.refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {transfers.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full min-w-200 border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("variant")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("from")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("to")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("quantity")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("status")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("date")}</th>
                  <th className="px-4 py-3 text-end font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tr) => (
                  <TransferRowView
                    key={tr.id}
                    transfer={tr}
                    locale={locale}
                    dateFmt={dateFmt}
                    label={t}
                    tErr={(e) => tErr(errKey(e))}
                    onChanged={() => router.refresh()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TransferRowView({
  transfer,
  locale,
  dateFmt,
  label,
  tErr,
  onChanged,
}: {
  transfer: TransferRow;
  locale: string;
  dateFmt: Intl.DateTimeFormat;
  label: ReturnType<typeof useTranslations<"inventory.transfers">>;
  tErr: (e: string) => string;
  onChanged: () => void;
}) {
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const status = transfer.status as Status;
  const pname = locale === "ar" ? transfer.variant.product.nameAr : transfer.variant.product.nameEn;
  const attrs = [transfer.variant.capacity, transfer.variant.colorName].filter(Boolean).join(" · ");

  const complete = () => {
    setError(null);
    startSave(async () => {
      const res = await updateTransferStatus({ transferId: transfer.id, status: "COMPLETED" });
      if (res.ok) onChanged();
      else setError(tErr(res.error));
    });
  };

  return (
    <tr className="border-border border-b transition-colors last:border-0">
      <td className="px-4 py-3">
        <div className="text-foreground font-medium">{pname}</div>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className="font-mono">{transfer.variant.variantSku}</span>
          {attrs && <span>· {attrs}</span>}
        </div>
        {error && (
          <p className="text-destructive mt-1 inline-flex items-center gap-1 text-xs">
            <AlertTriangle className="size-3" />
            {error}
          </p>
        )}
      </td>
      <td className="text-foreground px-4 py-3">{transfer.fromWarehouse.name}</td>
      <td className="text-foreground px-4 py-3">{transfer.toWarehouse.name}</td>
      <td className="text-foreground px-4 py-3 text-end font-medium tabular-nums">
        {formatNumber(transfer.quantity, locale)}
      </td>
      <td className="px-4 py-3">
        <Badge tone={statusTone[status]}>{label(`status_${status}`)}</Badge>
      </td>
      <td className="text-muted-foreground px-4 py-3 text-end tabular-nums">
        {dateFmt.format(transfer.date)}
      </td>
      <td className="px-4 py-3 text-end">
        {status !== "COMPLETED" && (
          <Button variant="outline" size="sm" onClick={complete} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
            {isSaving ? label("advancing") : label("markCompleted")}
          </Button>
        )}
      </td>
    </tr>
  );
}

function CreateTransferForm({
  locale,
  warehouses,
  tErr,
  onDone,
  onCancel,
}: {
  locale: string;
  warehouses: WarehouseColumn[];
  tErr: (e: string) => string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("inventory.transfers");
  const [variant, setVariant] = useState<TransferVariantOption | null>(null);
  const [fromWarehouseId, setFrom] = useState("");
  const [toWarehouseId, setTo] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [status, setStatus] = useState<Status>("PENDING");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const onSubmit = () => {
    if (!variant) return;
    setError(null);
    startSave(async () => {
      const res = await createTransfer({
        variantId: variant.id,
        fromWarehouseId,
        toWarehouseId,
        quantity: Number(quantity) || 0,
        status,
      });
      if (res.ok) onDone();
      else setError(tErr(res.error));
    });
  };

  const selectClass =
    "border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

  // Stock at the chosen source warehouse for the selected variant.
  const sourceStock = variant
    ? (variant.inventoryItems.find((i) => i.warehouseId === fromWarehouseId)?.quantityOnHand ?? 0)
    : 0;

  return (
    <div className="bg-card shadow-soft border-border flex flex-col gap-4 rounded-2xl border p-5">
      <VariantPicker locale={locale} selected={variant} onSelect={setVariant} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="tr-from">{t("from")}</Label>
          <select id="tr-from" value={fromWarehouseId} onChange={(e) => setFrom(e.target.value)} className={selectClass}>
            <option value="">{t("selectWarehouse")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {variant && fromWarehouseId && (
            <p className="text-muted-foreground mt-1 text-xs tabular-nums">
              {t("available", { count: sourceStock })}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="tr-to">{t("to")}</Label>
          <select id="tr-to" value={toWarehouseId} onChange={(e) => setTo(e.target.value)} className={selectClass}>
            <option value="">{t("selectWarehouse")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tr-qty">{t("quantity")}</Label>
          <Input
            id="tr-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            dir="ltr"
            className="text-end tabular-nums"
          />
        </div>
        <div>
          <Label htmlFor="tr-status">{t("status")}</Label>
          <select
            id="tr-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className={selectClass}
          >
            <option value="PENDING">{t("status_PENDING")}</option>
            <option value="IN_TRANSIT">{t("status_IN_TRANSIT")}</option>
            <option value="COMPLETED">{t("status_COMPLETED")}</option>
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
          <AlertTriangle className="size-4" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={onSubmit}
          disabled={isSaving || !variant || !fromWarehouseId || !toWarehouseId}
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          {isSaving ? t("creating") : t("create")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X />
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

function VariantPicker({
  locale,
  selected,
  onSelect,
}: {
  locale: string;
  selected: TransferVariantOption | null;
  onSelect: (v: TransferVariantOption | null) => void;
}) {
  const t = useTranslations("inventory.transfers");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<TransferVariantOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<number | undefined>(undefined);

  const run = (q: string) => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      if (q.trim().length < 2) {
        setItems([]);
        setOpen(false);
        return;
      }
      setSearching(true);
      setOpen(true);
      const res = await searchVariantsForTransfer(q);
      setItems(res);
      setSearching(false);
    }, 300);
  };

  if (selected) {
    const name = locale === "ar" ? selected.product.nameAr : selected.product.nameEn;
    return (
      <div className="border-success/40 bg-success/10 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5">
        <div>
          <div className="text-foreground text-sm font-medium">{name}</div>
          <div className="text-muted-foreground text-xs">
            <span className="font-mono">{selected.variantSku}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
        {searching && (
          <Loader2 className="text-muted-foreground absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
        )}
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            run(e.target.value);
          }}
          placeholder={t("selectVariant")}
          className="ps-9"
        />
      </div>
      {open && items.length > 0 && (
        <div className="bg-card shadow-elevated border-border scrollbar-subtle absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border">
          <ul className="py-1">
            {items.map((item) => {
              const name = locale === "ar" ? item.product.nameAr : item.product.nameEn;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="hover:bg-muted flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-foreground truncate text-sm font-medium">{name}</div>
                      <div className="text-muted-foreground text-xs">
                        <span className="font-mono">{item.variantSku}</span>
                        {item.capacity ? ` · ${item.capacity}` : ""}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
