"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { editStock } from "@/lib/inventory/actions";
import type { StockCell as Cell } from "@/lib/inventory/queries";

/**
 * One editable stock cell in the matrix. Shows quantityOnHand with a
 * low-stock highlight (qty < reorderLevel); clicking opens an inline editor
 * for quantity + reorder level that persists via the editStock action and
 * updates locally on success. Optimistic state stays local so the rest of
 * the matrix doesn't re-render.
 */
export function StockCellEditor({
  locale,
  variantId,
  warehouseId,
  cell,
}: {
  locale: string;
  variantId: string;
  warehouseId: string;
  cell: Cell;
}) {
  const t = useTranslations("inventory.matrix");
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(cell.quantityOnHand);
  const [reorder, setReorder] = useState(cell.reorderLevel);
  // Local display copy so a saved value persists without a full reload.
  const [display, setDisplay] = useState({
    quantityOnHand: cell.quantityOnHand,
    reorderLevel: cell.reorderLevel,
  });
  const [isSaving, startSave] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  const low = display.quantityOnHand < display.reorderLevel;

  const onSave = () => {
    startSave(async () => {
      const res = await editStock({
        variantId,
        warehouseId,
        quantityOnHand: Number(qty) || 0,
        reorderLevel: Number(reorder) || 0,
      });
      if (res.ok) {
        setDisplay({ quantityOnHand: res.quantityOnHand, reorderLevel: res.reorderLevel });
        setEditing(false);
        setJustSaved(true);
        window.setTimeout(() => setJustSaved(false), 1500);
      }
    });
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          aria-label={t("qty")}
          className="border-input bg-surface text-foreground h-8 w-20 rounded-lg border px-2 text-end text-sm tabular-nums focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
        />
        <input
          type="number"
          min={0}
          value={reorder}
          onChange={(e) => setReorder(Number(e.target.value))}
          aria-label={t("reorderLevel")}
          placeholder={t("reorderLevel")}
          className="border-input bg-surface text-muted-foreground h-7 w-20 rounded-lg border px-2 text-end text-xs tabular-nums focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            aria-label={t("save")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex size-7 items-center justify-center rounded-lg transition-colors"
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setQty(display.quantityOnHand);
              setReorder(display.reorderLevel);
            }}
            aria-label={t("cancel")}
            className="text-muted-foreground hover:bg-muted flex size-7 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setQty(display.quantityOnHand);
        setReorder(display.reorderLevel);
        setEditing(true);
      }}
      className={`group/cell inline-flex min-w-16 items-center justify-end gap-1.5 rounded-lg px-2 py-1 text-sm tabular-nums transition-colors ${
        low
          ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
          : "text-foreground hover:bg-muted"
      }`}
      aria-label={t("edit")}
    >
      {justSaved ? (
        <Check className="text-success size-3.5" />
      ) : (
        <Pencil className="size-3 opacity-0 transition-opacity group-hover/cell:opacity-60" />
      )}
      <span className="font-medium">{formatNumber(display.quantityOnHand, locale)}</span>
    </button>
  );
}
