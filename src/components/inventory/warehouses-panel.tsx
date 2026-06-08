"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, Warehouse } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "@/lib/inventory/actions";
import type { WarehouseRow } from "@/lib/inventory/queries";

const WH_ERRORS = ["nameRequired", "codeRequired", "cityRequired", "codeTaken", "notFound", "hasStock", "invalid", "unknown"] as const;
type WhErrorKey = (typeof WH_ERRORS)[number];

function toErrKey(e: string): WhErrorKey {
  return (WH_ERRORS as readonly string[]).includes(e) ? (e as WhErrorKey) : "unknown";
}

export function WarehousesPanel({
  warehouses,
}: {
  warehouses: WarehouseRow[];
}) {
  const t = useTranslations("inventory.warehouses");
  const router = useRouter();
  const { toast } = useToast();

  const [mode, setMode] = useState<"list" | "add" | "edit" | "delete">("list");
  const [selected, setSelected] = useState<WarehouseRow | null>(null);

  const refresh = () => router.refresh();

  if (mode === "add") {
    return (
      <WarehouseForm
        mode="add"
        onDone={() => { setMode("list"); refresh(); }}
        onCancel={() => setMode("list")}
        toast={toast}
        t={t}
      />
    );
  }

  if (mode === "edit" && selected) {
    return (
      <WarehouseForm
        mode="edit"
        initial={selected}
        onDone={() => { setMode("list"); refresh(); }}
        onCancel={() => setMode("list")}
        toast={toast}
        t={t}
      />
    );
  }

  if (mode === "delete" && selected) {
    return (
      <DeleteConfirm
        warehouse={selected}
        onDone={() => { setMode("list"); refresh(); }}
        onCancel={() => setMode("list")}
        toast={toast}
        t={t}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-foreground text-lg font-semibold">{t("title")}</h2>
        <Button size="sm" onClick={() => setMode("add")}>
          <Plus />
          {t("add")}
        </Button>
      </div>

      {warehouses.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="bg-card shadow-soft border-border overflow-hidden rounded-2xl border">
          <div className="scrollbar-subtle overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3 text-start font-semibold">{t("col.name")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("col.code")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("col.city")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("col.skus")}</th>
                  <th className="px-4 py-3 text-end font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((wh) => (
                  <tr key={wh.id} className="border-border hover:bg-muted/40 border-b transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                          <Warehouse className="size-4" />
                        </span>
                        <span className="text-foreground font-medium">{wh.name}</span>
                      </div>
                    </td>
                    <td className="text-foreground px-4 py-3 font-mono text-xs font-medium">
                      {wh.code}
                    </td>
                    <td className="text-foreground px-4 py-3">{wh.city}</td>
                    <td className="text-foreground px-4 py-3 text-end tabular-nums">
                      {wh._count.inventoryItems}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => { setSelected(wh); setMode("edit"); }}
                          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
                          aria-label={t("editAriaLabel", { name: wh.name })}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelected(wh); setMode("delete"); }}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg p-1.5 transition-colors"
                          aria-label={t("deleteAriaLabel", { name: wh.name })}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

type FormMode = "add" | "edit";

function WarehouseForm({
  mode,
  initial,
  onDone,
  onCancel,
  toast,
  t,
}: {
  mode: FormMode;
  initial?: WarehouseRow;
  onDone: () => void;
  onCancel: () => void;
  toast: ReturnType<typeof useToast>["toast"];
  t: ReturnType<typeof useTranslations<"inventory.warehouses">>;
}) {
  const tErr = useTranslations("inventory.warehouseErrors");
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const onSubmit = () => {
    setError(null);
    startSave(async () => {
      let res;
      if (mode === "add") {
        res = await createWarehouse({ name, code, city });
      } else {
        res = await updateWarehouse({ id: initial!.id, name, code, city });
      }
      if (res.ok) {
        toast(mode === "add" ? t("createdToast") : t("updatedToast"), "success");
        onDone();
      } else {
        const msg = tErr(toErrKey(res.error));
        setError(msg);
        toast(msg, "error");
      }
    });
  };

  const isDisabled = !name.trim() || !code.trim() || !city.trim() || isSaving;

  return (
    <div className="bg-card shadow-soft border-border flex flex-col gap-5 rounded-2xl border p-5">
      <h2 className="font-display text-foreground text-lg font-semibold">
        {mode === "add" ? t("addTitle") : t("editTitle")}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="wh-name">{t("field.name")}</Label>
          <Input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("field.namePlaceholder")} />
        </div>
        <div>
          <Label htmlFor="wh-code">{t("field.code")}</Label>
          <Input
            id="wh-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="RUH-01"
            className="font-mono uppercase"
            maxLength={20}
          />
        </div>
        <div>
          <Label htmlFor="wh-city">{t("field.city")}</Label>
          <Input id="wh-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("field.cityPlaceholder")} />
        </div>
      </div>

      {error && (
        <FieldError>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            {error}
          </span>
        </FieldError>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={onSubmit} disabled={isDisabled}>
          {isSaving && <Loader2 className="animate-spin" />}
          {isSaving ? t("saving") : mode === "add" ? t("createBtn") : t("saveBtn")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

function DeleteConfirm({
  warehouse,
  onDone,
  onCancel,
  toast,
  t,
}: {
  warehouse: WarehouseRow;
  onDone: () => void;
  onCancel: () => void;
  toast: ReturnType<typeof useToast>["toast"];
  t: ReturnType<typeof useTranslations<"inventory.warehouses">>;
}) {
  const tErr = useTranslations("inventory.warehouseErrors");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const confirm = () => {
    setError(null);
    startDelete(async () => {
      const res = await deleteWarehouse({ id: warehouse.id });
      if (res.ok) {
        toast(t("deletedToast"), "success");
        onDone();
      } else {
        const msg = tErr(toErrKey(res.error));
        setError(msg);
        toast(msg, "error");
      }
    });
  };

  return (
    <div className="bg-card shadow-soft border-border flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <span className="bg-destructive/12 text-destructive flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Trash2 className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-foreground text-lg font-semibold">{t("deleteTitle")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t("deleteConfirm", { name: warehouse.name })}</p>
          {warehouse._count.inventoryItems > 0 && (
            <p className="text-destructive mt-2 text-sm font-medium">
              {t("deleteHasStock", { count: warehouse._count.inventoryItems })}
            </p>
          )}
        </div>
      </div>

      {error && (
        <FieldError>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            {error}
          </span>
        </FieldError>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={confirm}
          disabled={isDeleting}
        >
          {isDeleting && <Loader2 className="animate-spin" />}
          {isDeleting ? t("deleting") : t("deleteBtn")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
