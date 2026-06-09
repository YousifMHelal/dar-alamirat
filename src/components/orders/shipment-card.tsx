"use client";

import { useState, useTransition } from "react";
import { Warehouse, ChevronDown, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ShipmentStatusBadge } from "@/components/orders/status-badge";
import { SplitShipmentDialog } from "@/components/orders/split-shipment-dialog";
import { updateShipmentStatus, updateShipmentCarrier } from "@/lib/orders/fulfillment";
import type { ShipmentStatus, Carrier } from "@/generated/prisma/enums";

interface ShipmentItemRow {
  id: string;
  orderItemId: string;
  quantity: number;
  sku: string;
  productName: string;
  colorName?: string | null;
}

interface ShipmentCardProps {
  shipment: {
    id: string;
    carrier: Carrier;
    waybillNumber: string | null;
    status: ShipmentStatus;
    warehouse: { id: string; name: string; code: string; city: string } | null;
    items: ShipmentItemRow[];
  };
  allStatuses: { value: ShipmentStatus; label: string }[];
  allCarriers: { value: Carrier; label: string }[];
  warehouses: { id: string; name: string }[];
  locale: "en" | "ar";
  index: number;
}

export function ShipmentCard({
  shipment,
  allStatuses,
  allCarriers,
  warehouses,
  locale,
  index,
}: ShipmentCardProps) {
  const t = useTranslations("orders.detail");
  const { toast } = useToast();
  const [isPendingStatus, startStatusTransition] = useTransition();
  const [isPendingCarrier, startCarrierTransition] = useTransition();
  const [showSplit, setShowSplit] = useState(false);
  const [showItems, setShowItems] = useState(false);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as ShipmentStatus;
    startStatusTransition(async () => {
      const res = await updateShipmentStatus(shipment.id, newStatus, locale);
      if (res.ok) {
        toast(t("shipmentUpdated"), "success");
      } else {
        toast(res.error, "error");
      }
    });
  }

  function handleCarrierChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newCarrier = e.target.value as Carrier;
    startCarrierTransition(async () => {
      const res = await updateShipmentCarrier(shipment.id, newCarrier);
      if (res.ok) {
        toast(t("shipmentUpdated"), "success");
      } else {
        toast(res.error === "waybillAlreadyCreated" ? t("carrierChangeBlocked") : res.error, "error");
      }
    });
  }

  const isFinalised =
    shipment.status === "DELIVERED" || shipment.status === "RETURNED";

  return (
    <>
      <li className="border-border rounded-2xl border">
        {/* Card header */}
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="bg-primary-soft text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Warehouse className="size-4" />
            </span>
            <div>
              <div className="text-foreground text-sm font-medium">
                {shipment.warehouse
                  ? t("fromWarehouse", { warehouse: shipment.warehouse.name })
                  : `${t("shipments")} ${index + 1}`}
              </div>
              <div className="text-muted-foreground text-xs">
                {shipment.carrier}
                {shipment.waybillNumber && (
                  <>
                    {" · "}
                    {t("waybill")} {shipment.waybillNumber}
                  </>
                )}
              </div>
            </div>
          </div>
          <ShipmentStatusBadge
            status={shipment.status}
            label={allStatuses.find((s) => s.value === shipment.status)?.label ?? shipment.status}
          />
        </div>

        {/* Controls */}
        {!isFinalised && (
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
            {/* Status selector */}
            <div className="relative flex items-center">
              <select
                value={shipment.status}
                onChange={handleStatusChange}
                disabled={isPendingStatus}
                className="border-border bg-surface-muted text-foreground appearance-none rounded-lg border py-1.5 ps-3 pe-7 text-xs font-medium"
              >
                {allStatuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute end-2 size-3" />
            </div>

            {/* Carrier selector */}
            <div className="relative flex items-center">
              <select
                value={shipment.carrier}
                onChange={handleCarrierChange}
                disabled={isPendingCarrier || !!shipment.waybillNumber}
                className="border-border bg-surface-muted text-foreground appearance-none rounded-lg border py-1.5 ps-3 pe-7 text-xs font-medium disabled:opacity-50"
              >
                {allCarriers.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute end-2 size-3" />
            </div>

            {/* Split button */}
            {shipment.items.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSplit(true)}
                className="ms-auto"
              >
                <Scissors className="size-3.5" />
                {t("splitShipment")}
              </Button>
            )}
          </div>
        )}

        {/* Items toggle */}
        {shipment.items.length > 0 && (
          <div className="border-border border-t">
            <button
              type="button"
              onClick={() => setShowItems((v) => !v)}
              className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors"
            >
              <ChevronDown
                className={`size-3.5 transition-transform ${showItems ? "rotate-180" : ""}`}
              />
              {t("shipmentItems")} ({shipment.items.length})
            </button>
            {showItems && (
              <ul className="border-border border-t px-4 py-2">
                {shipment.items.map((item) => (
                  <li
                    key={item.id}
                    className="border-border flex items-center justify-between gap-2 border-b py-1.5 last:border-0"
                  >
                    <div>
                      <span className="text-foreground text-xs font-medium">{item.productName}</span>
                      {item.colorName && (
                        <span className="text-muted-foreground text-xs"> · {item.colorName}</span>
                      )}
                      <span className="text-muted-foreground block text-xs">{item.sku}</span>
                    </div>
                    <span className="text-muted-foreground text-xs tabular-nums">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </li>

      {showSplit && (
        <SplitShipmentDialog
          shipmentId={shipment.id}
          items={shipment.items}
          warehouses={warehouses}
          onClose={() => setShowSplit(false)}
          onSuccess={() => setShowSplit(false)}
        />
      )}
    </>
  );
}
