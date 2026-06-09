"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { toDecimal } from "@/lib/money";
import {
  affiliateSchema,
  updateAffiliateSchema,
  type AffiliateInput,
  type UpdateAffiliateInput,
} from "./schema";

export type AffiliateMutationResult =
  | { ok: true; affiliateId: string }
  | { ok: false; error: string };

export type DeleteResult = { ok: true } | { ok: false; error: string };

const orNull = (v: string | undefined | null): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

export async function createAffiliate(input: AffiliateInput): Promise<AffiliateMutationResult> {
  await requireUser();
  const parsed = affiliateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  try {
    const affiliate = await prisma.affiliate.create({
      data: {
        name: d.name,
        handle: d.handle,
        channel: d.channel,
        code: d.code.toUpperCase(),
        email: orNull(d.email),
        phone: orNull(d.phone),
        commissionRate: toDecimal(d.commissionRate),
        status: d.status,
        contractTerms: orNull(d.contractTerms),
      },
      select: { id: true },
    });
    revalidatePath("/affiliates");
    return { ok: true, affiliateId: affiliate.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "codeTaken" };
    }
    console.error("[affiliates] createAffiliate failed:", e);
    return { ok: false, error: "unknown" };
  }
}

export async function updateAffiliate(input: UpdateAffiliateInput): Promise<AffiliateMutationResult> {
  await requireUser();
  const parsed = updateAffiliateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  const existing = await prisma.affiliate.findUnique({ where: { id: d.id }, select: { id: true } });
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await prisma.affiliate.update({
      where: { id: d.id },
      data: {
        name: d.name,
        handle: d.handle,
        channel: d.channel,
        code: d.code.toUpperCase(),
        email: orNull(d.email),
        phone: orNull(d.phone),
        commissionRate: toDecimal(d.commissionRate),
        status: d.status,
        contractTerms: orNull(d.contractTerms),
      },
    });
    revalidatePath("/affiliates");
    revalidatePath(`/affiliates/${d.id}`);
    return { ok: true, affiliateId: d.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "codeTaken" };
    }
    console.error("[affiliates] updateAffiliate failed:", e);
    return { ok: false, error: "unknown" };
  }
}

export async function deleteAffiliate(id: string): Promise<DeleteResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };
  try {
    await prisma.affiliate.delete({ where: { id } });
    revalidatePath("/affiliates");
    return { ok: true };
  } catch (e) {
    console.error("[affiliates] deleteAffiliate failed:", e);
    return { ok: false, error: "unknown" };
  }
}
