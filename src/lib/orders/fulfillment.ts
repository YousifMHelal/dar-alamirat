"use server";

/**
 * Fulfillment server actions for the Orders module.
 *
 * - updateOrderStatus: persists a status change and fires a WhatsApp
 *   order_status_update template message to the customer.
 * - createShipmentWaybill: calls the correct carrier API to generate a
 *   waybill number and stores it on the Shipment record.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import {
  sendOrderStatusUpdate,
  ORDER_STATUS_LABELS,
} from "@/lib/integrations/whatsapp";
import { createAramexShipment } from "@/lib/integrations/aramex";
import { createSmsaShipment } from "@/lib/integrations/smsa";
import { createSplShipment } from "@/lib/integrations/spl";
import type { Carrier, OrderStatus, ShipmentStatus } from "@/generated/prisma/enums";

// ─────────────────────────────────────────────────────────────
// Update order status + fire WhatsApp notification
// ─────────────────────────────────────────────────────────────

export type UpdateOrderStatusResult =
  | { ok: true; whatsapp: "sent" | "skipped" | "failed"; whatsappError?: string }
  | { ok: false; error: string };

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  locale: "en" | "ar" = "en",
): Promise<UpdateOrderStatusResult> {
  await requireUser();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customer: { select: { id: true, name: true, phone: true } },
      shipments: { select: { waybillNumber: true }, take: 1 },
    },
  });

  if (!order) return { ok: false, error: "orderNotFound" };

  // Persist the status change, and atomically award loyalty points when the
  // order reaches DELIVERED (1 point per 1 SAR of subtotal, rounded down).
  if (newStatus === "DELIVERED") {
    await prisma.$transaction(async (tx) => {
      const fullOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { subtotal: true },
      });
      const pointsToAward = fullOrder ? Math.floor(Number(fullOrder.subtotal)) : 0;
      await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });
      if (pointsToAward > 0) {
        await tx.customer.update({
          where: { id: order.customer.id },
          data: { loyaltyPoints: { increment: pointsToAward } },
        });
      }
    });
  } else {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);

  // Fire WhatsApp notification — failure here does NOT roll back the status
  // update; we surface it as a non-critical warning.
  const statusLabels = ORDER_STATUS_LABELS[newStatus];
  const statusLabel = locale === "ar" ? statusLabels?.ar : statusLabels?.en;

  const waybill = order.shipments[0]?.waybillNumber ?? undefined;

  const waResult = await sendOrderStatusUpdate({
    to: order.customer.phone,
    customerName: order.customer.name,
    orderNumber: order.orderNumber,
    statusLabel: statusLabel ?? newStatus,
    detail: waybill,
    locale,
  });

  if (!waResult.ok) {
    return {
      ok: true,
      whatsapp: "failed",
      whatsappError: waResult.error,
    };
  }

  return { ok: true, whatsapp: "sent" };
}

// ─────────────────────────────────────────────────────────────
// Create waybill for a shipment
// ─────────────────────────────────────────────────────────────

export type CreateWaybillResult =
  | { ok: true; waybillNumber: string; labelUrl?: string }
  | { ok: false; error: string };

interface ShipmentAddress {
  name: string;
  phone: string;
  city: string;
  address: string;
  postCode?: string;
  countryCode?: string;
}

/**
 * Create a waybill for an existing Shipment record via the shipment's
 * carrier API and persist the waybill number.
 *
 * @param shipmentId    DB id of the Shipment record
 * @param destination   Customer delivery address (from Order/Customer)
 */
export async function createShipmentWaybill(
  shipmentId: string,
  destination: ShipmentAddress,
): Promise<CreateWaybillResult> {
  await requireUser();

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      carrier: true,
      waybillNumber: true,
      order: {
        select: {
          orderNumber: true,
          items: {
            select: {
              quantity: true,
              variant: { select: { product: { select: { nameEn: true } } } },
            },
          },
        },
      },
      warehouse: {
        select: {
          name: true,
          city: true,
          // Warehouses don't yet store a phone/postcode; use sensible defaults.
          code: true,
        },
      },
    },
  });

  if (!shipment) return { ok: false, error: "Shipment not found" };
  if (shipment.waybillNumber) {
    return { ok: false, error: "Shipment already has a waybill" };
  }

  const orderNumber = shipment.order.orderNumber;
  const totalPieces = shipment.order.items.reduce((s, i) => s + i.quantity, 0);
  const description = shipment.order.items
    .map((i) => i.variant.product.nameEn)
    .slice(0, 3)
    .join(", ");

  const origin: ShipmentAddress = {
    name: shipment.warehouse?.name ?? "Dar Al-Amirat Warehouse",
    phone: process.env.WAREHOUSE_PHONE ?? "+966112345678",
    city: shipment.warehouse?.city ?? "Riyadh",
    address: `Warehouse ${shipment.warehouse?.code ?? "W1"}`,
    postCode: "11564",
    countryCode: "SA",
  };

  let waybillResult: CreateWaybillResult;

  switch (shipment.carrier as Carrier) {
    case "ARAMEX": {
      const res = await createAramexShipment({
        originName: origin.name,
        originPhone: origin.phone,
        originCity: origin.city,
        originCountryCode: origin.countryCode ?? "SA",
        originPostCode: origin.postCode ?? "11564",
        originLine1: origin.address,
        destName: destination.name,
        destPhone: destination.phone,
        destCity: destination.city,
        destCountryCode: destination.countryCode ?? "SA",
        destPostCode: destination.postCode ?? "00000",
        destLine1: destination.address,
        referenceNumber: orderNumber,
        description,
        weightKg: Math.max(0.5, totalPieces * 0.3),
        numberOfPieces: totalPieces,
      });
      waybillResult = res.ok
        ? { ok: true, waybillNumber: res.result.waybillNumber, labelUrl: res.result.labelUrl }
        : { ok: false, error: res.error };
      break;
    }

    case "SMSA": {
      const res = await createSmsaShipment({
        senderName: origin.name,
        senderPhone: origin.phone,
        senderCity: origin.city,
        senderAddress: origin.address,
        receiverName: destination.name,
        receiverPhone: destination.phone,
        receiverCity: destination.city,
        receiverAddress: destination.address,
        referenceNumber: orderNumber,
        description,
        weightKg: Math.max(0.5, totalPieces * 0.3),
        numberOfPieces: totalPieces,
      });
      waybillResult = res.ok
        ? { ok: true, waybillNumber: res.result.waybillNumber, labelUrl: res.result.labelUrl }
        : { ok: false, error: res.error };
      break;
    }

    case "SPL": {
      const res = await createSplShipment({
        senderName: origin.name,
        senderPhone: origin.phone,
        senderCity: origin.city,
        senderAddress: origin.address,
        senderPostCode: origin.postCode ?? "11564",
        receiverName: destination.name,
        receiverPhone: destination.phone,
        receiverCity: destination.city,
        receiverAddress: destination.address,
        receiverPostCode: destination.postCode ?? "00000",
        referenceNumber: orderNumber,
        description,
        weightKg: Math.max(0.5, totalPieces * 0.3),
        numberOfPieces: totalPieces,
      });
      waybillResult = res.ok
        ? { ok: true, waybillNumber: res.result.waybillNumber }
        : { ok: false, error: res.error };
      break;
    }

    default:
      return { ok: false, error: `Unknown carrier: ${shipment.carrier}` };
  }

  if (!waybillResult.ok) return waybillResult;

  // Persist waybill number on the Shipment.
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      waybillNumber: waybillResult.waybillNumber,
      status: "IN_TRANSIT",
    },
  });

  revalidatePath("/orders");

  return waybillResult;
}

// ─────────────────────────────────────────────────────────────
// Update a single shipment's status
// ─────────────────────────────────────────────────────────────

export type UpdateShipmentStatusResult =
  | { ok: true; whatsapp: "sent" | "skipped" | "failed"; whatsappError?: string }
  | { ok: false; error: string };

export async function updateShipmentStatus(
  shipmentId: string,
  newStatus: ShipmentStatus,
  locale: "en" | "ar" = "en",
): Promise<UpdateShipmentStatusResult> {
  await requireUser();

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      waybillNumber: true,
      carrier: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          subtotal: true,
          customer: { select: { id: true, name: true, phone: true } },
          shipments: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!shipment) return { ok: false, error: "shipmentNotFound" };

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: newStatus },
  });

  // When this shipment is now DELIVERED, check if all shipments are delivered
  // → if so, mark the order DELIVERED and award loyalty points.
  if (newStatus === "DELIVERED") {
    const allDelivered = shipment.order.shipments.every(
      (s) => s.id === shipmentId || s.status === "DELIVERED",
    );
    if (allDelivered) {
      await prisma.$transaction(async (tx) => {
        const pointsToAward = Math.floor(Number(shipment.order.subtotal));
        await tx.order.update({
          where: { id: shipment.order.id },
          data: { status: "DELIVERED" },
        });
        if (pointsToAward > 0) {
          await tx.customer.update({
            where: { id: shipment.order.customer.id },
            data: { loyaltyPoints: { increment: pointsToAward } },
          });
        }
      });
    }
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${shipment.order.id}`);

  // WhatsApp notification — non-critical, won't roll back the status update.
  const { ORDER_STATUS_LABELS } = await import("@/lib/integrations/whatsapp");
  const statusLabels = ORDER_STATUS_LABELS[newStatus as keyof typeof ORDER_STATUS_LABELS];
  const statusLabel =
    statusLabels
      ? locale === "ar"
        ? (statusLabels as { ar: string }).ar
        : (statusLabels as { en: string }).en
      : newStatus;

  const detail = shipment.waybillNumber
    ? `${shipment.carrier} · ${shipment.waybillNumber}`
    : undefined;

  const waResult = await sendOrderStatusUpdate({
    to: shipment.order.customer.phone,
    customerName: shipment.order.customer.name,
    orderNumber: shipment.order.orderNumber,
    statusLabel,
    detail,
    locale,
  });

  if (!waResult.ok) {
    return { ok: true, whatsapp: "failed", whatsappError: waResult.error };
  }
  return { ok: true, whatsapp: "sent" };
}

// ─────────────────────────────────────────────────────────────
// Update a single shipment's carrier
// ─────────────────────────────────────────────────────────────

export type UpdateShipmentCarrierResult = { ok: true } | { ok: false; error: string };

export async function updateShipmentCarrier(
  shipmentId: string,
  carrier: Carrier,
): Promise<UpdateShipmentCarrierResult> {
  await requireUser();

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, waybillNumber: true, order: { select: { id: true } } },
  });

  if (!shipment) return { ok: false, error: "shipmentNotFound" };
  if (shipment.waybillNumber) {
    return { ok: false, error: "waybillAlreadyCreated" };
  }

  await prisma.shipment.update({ where: { id: shipmentId }, data: { carrier } });

  revalidatePath("/orders");
  revalidatePath(`/orders/${shipment.order.id}`);

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Manually split a shipment into two
// ─────────────────────────────────────────────────────────────

export interface SplitLine {
  orderItemId: string;
  quantity: number;
}

export type SplitShipmentResult =
  | { ok: true; newShipmentId: string }
  | { ok: false; error: string };

export async function splitShipment(
  shipmentId: string,
  splitLines: SplitLine[],
  newCarrier: Carrier,
  newWarehouseId?: string,
): Promise<SplitShipmentResult> {
  await requireUser();

  if (!splitLines.length) return { ok: false, error: "noLinesProvided" };

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      orderId: true,
      status: true,
      items: { select: { id: true, orderItemId: true, quantity: true } },
      order: { select: { id: true, status: true } },
    },
  });

  if (!shipment) return { ok: false, error: "shipmentNotFound" };
  if (shipment.order.status === "DELIVERED" || shipment.order.status === "CANCELLED") {
    return { ok: false, error: "orderAlreadyFinalised" };
  }
  if (shipment.status === "DELIVERED" || shipment.status === "RETURNED") {
    return { ok: false, error: "shipmentAlreadyFinalised" };
  }

  // Validate quantities don't exceed what's in the source shipment.
  for (const sl of splitLines) {
    const existing = shipment.items.find((i) => i.orderItemId === sl.orderItemId);
    if (!existing) return { ok: false, error: `itemNotInShipment:${sl.orderItemId}` };
    if (sl.quantity <= 0 || sl.quantity > existing.quantity) {
      return { ok: false, error: `invalidQuantity:${sl.orderItemId}` };
    }
  }

  const newShipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        orderId: shipment.orderId,
        carrier: newCarrier,
        status: "PENDING",
        warehouseId: newWarehouseId ?? null,
      },
      select: { id: true },
    });

    for (const sl of splitLines) {
      const source = shipment.items.find((i) => i.orderItemId === sl.orderItemId)!;
      const remaining = source.quantity - sl.quantity;

      // Create ShipmentItem on the new shipment.
      await tx.shipmentItem.create({
        data: {
          shipmentId: created.id,
          orderItemId: sl.orderItemId,
          quantity: sl.quantity,
        },
      });

      if (remaining > 0) {
        // Reduce quantity on the source ShipmentItem.
        await tx.shipmentItem.update({
          where: { id: source.id },
          data: { quantity: remaining },
        });
      } else {
        // Remove from source shipment entirely.
        await tx.shipmentItem.delete({ where: { id: source.id } });
      }
    }

    return created;
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${shipment.order.id}`);

  return { ok: true, newShipmentId: newShipment.id };
}
