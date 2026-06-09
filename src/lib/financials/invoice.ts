"use server";

/**
 * ZATCA invoice generation server action.
 * Produces a UBL 2.1 XML + TLV QR code for an order and stores the QR
 * on a Setting key so the dashboard can retrieve it.
 */

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { generateZatcaInvoice } from "@/lib/integrations/zatca";
import type { Prisma as PrismaType } from "@/generated/prisma/client";

export type GenerateInvoiceResult =
  | { ok: true; xml: string; qrCode: string; submissionStatus?: string; warnings?: string[]; errors?: string[] }
  | { ok: false; error: string };

export async function generateInvoiceForOrder(orderId: string): Promise<GenerateInvoiceResult> {
  await requireUser();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      type: true,
      subtotal: true,
      vatAmount: true,
      total: true,
      placedAt: true,
      customer: {
        select: {
          name: true,
          type: true,
          vatNumber: true,
        },
      },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          variant: {
            select: {
              product: { select: { nameEn: true } },
            },
          },
        },
      },
    },
  });

  if (!order) return { ok: false, error: "Order not found" };

  const result = await generateZatcaInvoice({
    invoiceNumber: order.orderNumber,
    issueDate: order.placedAt,
    buyerName: order.customer.name,
    buyerVat: order.type === "WHOLESALE" ? (order.customer.vatNumber ?? undefined) : undefined,
    lines: order.items.map((item) => ({
      description: item.variant.product.nameEn,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    })),
    subtotal: Number(order.subtotal),
    vatAmount: Number(order.vatAmount),
    total: Number(order.total),
    invoiceType: order.type === "WHOLESALE" ? "standard" : "simplified",
  });

  if (!result.ok) return { ok: false, error: result.error };

  // Cache the QR code in settings keyed by order id.
  await prisma.setting.upsert({
    where: { key: `zatca.qr.${order.orderNumber}` },
    create: {
      key: `zatca.qr.${order.orderNumber}`,
      valueJson: { qrCode: result.result.qrCode, xml: result.result.xml } as unknown as PrismaType.InputJsonValue,
    },
    update: {
      valueJson: { qrCode: result.result.qrCode, xml: result.result.xml } as unknown as PrismaType.InputJsonValue,
    },
  });

  return {
    ok: true,
    xml: result.result.xml,
    qrCode: result.result.qrCode,
    submissionStatus: result.result.submissionStatus,
    warnings: result.result.warnings,
    errors: result.result.errors,
  };
}

