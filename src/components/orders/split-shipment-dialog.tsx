"use client";

import { useState, useTransition } from "react";
import { X, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { splitShipment } from "@/lib/orders/fulfillment";
import type { Carrier } from "@/generated/prisma/enums";

interface ShipmentItemRow {
  id: string;
  orderItemId: string;
  quantity: number;
  sku: string;
  productName: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Props {
  shipmentId: string;
  items: ShipmentItemRow[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSuccess: () => void;
}

const CARRIERS: Carrier[] = ["ARAMEX", "SMSA", "SPL"];

export function SplitShipmentDialog({ shipmentId, items, warehouses, onClose, onSuccess }: Props) {
  const t = useTranslations("orders.detail");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<Record<string, number>>({});
  const [carrier, setCarrier] = useState<Carrier>("ARAMEX");
  const [warehouseId, setWarehouseId] = useState<string>("");

  function toggleItem(orderItemId: string, maxQty: number) {
    setSelected((prev) => {
      if (orderItemId in prev) {
        const next = { ...prev };
        delete next[orderItemId];
        return next;
      }
      return { ...prev, [orderItemId]: maxQty };
    });
  }

  function setQty(orderItemId: string, qty: number) {
    setSelected((prev) => ({ ...prev, [orderItemId]: qty }));
  }

  function handleConfirm() {
    const splitLines = Object.entries(selected).map(([orderItemId, quantity]) => ({
      orderItemId,
      quantity,
    }));
    if (!splitLines.length) {
      toast("Select at least one item.", "error");
      return;
    }

    startTransition(async () => {
      const res = await splitShipment(
        shipmentId,
        splitLines,
        carrier,
        warehouseId || undefined,
      );
      if (res.ok) {
        toast(t("splitSuccess"), "success");
        onSuccess();
      } else {
        toast(res.error, "error");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="bg-card border-border shadow-soft w-full max-w-lg rounded-2xl border">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-foreground text-base font-semibold">{t("splitDialog.title")}</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">{t("splitDialog.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Items */}
        <div className="max-h-64 overflow-y-auto px-5 py-3">
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const isChecked = item.orderItemId in selected;
              const qty = selected[item.orderItemId] ?? item.quantity;
              return (
                <li
                  key={item.id}
                  className="border-border flex items-center gap-3 rounded-xl border px-4 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItem(item.orderItemId, item.quantity)}
                    className="accent-primary size-4 shrink-0 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate text-sm font-medium">
                      {item.productName}
                    </div>
                    <div className="text-muted-foreground text-xs">{item.sku}</div>
                  </div>
                  {isChecked && (
                    <input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={qty}
                      onChange={(e) => setQty(item.orderItemId, Math.max(1, Math.min(item.quantity, Number(e.target.value))))}
                      className="border-border bg-background text-foreground w-16 rounded-lg border px-2 py-1 text-center text-sm"
                    />
                  )}
                  {!isChecked && (
                    <span className="text-muted-foreground w-16 text-center text-sm tabular-nums">
                      ×{item.quantity}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Carrier + Warehouse */}
        <div className="border-border flex flex-col gap-3 border-t px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-foreground text-xs font-medium">
              {t("splitDialog.newCarrier")}
            </label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value as Carrier)}
              className="border-border bg-background text-foreground w-full rounded-xl border px-3 py-2 text-sm"
            >
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {warehouses.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-foreground text-xs font-medium">
                {t("splitDialog.newWarehouse")}
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="border-border bg-background text-foreground w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="">{t("splitDialog.noWarehouse")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-border flex justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !Object.keys(selected).length}>
            <Scissors className="size-4" />
            {isPending ? t("splitDialog.splitting") : t("splitDialog.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
