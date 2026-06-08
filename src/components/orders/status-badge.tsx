import {
  CheckCircle2,
  Clock,
  PackageCheck,
  RotateCcw,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  OrderStatus,
  OrderType,
  PaymentStatus,
  ShipmentStatus,
} from "@/generated/prisma/enums";
import { Badge, type BadgeProps } from "@/components/ui/badge";

/**
 * Centralised mapping from domain enum → badge tone + icon. Keeping this in
 * one place means an order status reads the same colour and icon in the
 * table, the detail page, and anywhere else. Icon + text together satisfy
 * the "don't rely on colour alone" guideline.
 */

type Tone = NonNullable<BadgeProps["tone"]>;

const ORDER_STATUS: Record<OrderStatus, { tone: Tone; icon: LucideIcon }> = {
  PENDING: { tone: "warning", icon: Clock },
  CONFIRMED: { tone: "info", icon: CheckCircle2 },
  PROCESSING: { tone: "info", icon: PackageCheck },
  SHIPPED: { tone: "primary", icon: Truck },
  DELIVERED: { tone: "success", icon: CheckCircle2 },
  CANCELLED: { tone: "danger", icon: XCircle },
};

const PAYMENT_STATUS: Record<PaymentStatus, Tone> = {
  PENDING: "warning",
  PAID: "success",
  RECONCILED: "success",
  FAILED: "danger",
};

const SHIPMENT_STATUS: Record<ShipmentStatus, { tone: Tone; icon: LucideIcon }> = {
  PENDING: { tone: "warning", icon: Clock },
  IN_TRANSIT: { tone: "info", icon: Truck },
  DELIVERED: { tone: "success", icon: PackageCheck },
  RETURNED: { tone: "danger", icon: RotateCcw },
};

export function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  const { tone, icon: Icon } = ORDER_STATUS[status];
  return (
    <Badge tone={tone}>
      <Icon />
      {label}
    </Badge>
  );
}

export function OrderTypeBadge({ type, label }: { type: OrderType; label: string }) {
  return <Badge tone={type === "WHOLESALE" ? "primary" : "outline"}>{label}</Badge>;
}

export function PaymentStatusBadge({ status, label }: { status: PaymentStatus; label: string }) {
  return <Badge tone={PAYMENT_STATUS[status]}>{label}</Badge>;
}

export function ShipmentStatusBadge({ status, label }: { status: ShipmentStatus; label: string }) {
  const { tone, icon: Icon } = SHIPMENT_STATUS[status];
  return (
    <Badge tone={tone}>
      <Icon />
      {label}
    </Badge>
  );
}
