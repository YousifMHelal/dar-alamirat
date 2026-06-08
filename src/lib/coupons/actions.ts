"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { toDecimal } from "@/lib/money";
import { couponSchema, updateCouponSchema, type CouponInput, type UpdateCouponInput } from "./schema";

/**
 * Server actions for the Coupons module. Each mutation asserts an auth'd
 * user, validates with Zod, and returns a `{ ok }` discriminated union
 * instead of throwing. Money/limit strings are converted to Prisma types
 * here; code uniqueness is enforced by the DB and surfaced as a friendly
 * error key.
 */

export type CouponMutationResult =
  | { ok: true; couponId: string }
  | { ok: false; error: string };

export type DeleteResult = { ok: true } | { ok: false; error: string };

const orNull = (v: string | undefined | null): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

function buildData(d: CouponInput) {
  return {
    code: d.code,
    description: orNull(d.description),
    type: d.type,
    value: toDecimal(d.value),
    minOrder: d.minOrder && d.minOrder.trim() ? toDecimal(d.minOrder) : null,
    usageLimit: d.usageLimit && d.usageLimit.trim() ? Number(d.usageLimit) : null,
    startsAt: new Date(d.startsAt),
    endsAt: d.endsAt && d.endsAt.trim() ? new Date(d.endsAt) : null,
    status: d.status,
  };
}

export async function createCoupon(input: CouponInput): Promise<CouponMutationResult> {
  await requireUser();
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  try {
    const coupon = await prisma.coupon.create({
      data: buildData(parsed.data),
      select: { id: true },
    });
    revalidatePath("/coupons");
    return { ok: true, couponId: coupon.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "codeTaken" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function updateCoupon(input: UpdateCouponInput): Promise<CouponMutationResult> {
  await requireUser();
  const parsed = updateCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  const existing = await prisma.coupon.findUnique({ where: { id: d.id }, select: { id: true } });
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await prisma.coupon.update({
      where: { id: d.id },
      data: buildData(d),
    });
    revalidatePath("/coupons");
    return { ok: true, couponId: d.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "codeTaken" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function deleteCoupon(id: string): Promise<DeleteResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };
  try {
    await prisma.coupon.delete({ where: { id } });
    revalidatePath("/coupons");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { ok: false, error: "couponInUse" };
    }
    return { ok: false, error: "unknown" };
  }
}
