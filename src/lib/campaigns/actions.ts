"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { toDecimal } from "@/lib/money";
import {
  campaignSchema,
  updateCampaignSchema,
  type CampaignInput,
  type UpdateCampaignInput,
} from "./schema";

export type CampaignMutationResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: string };

export type DeleteResult = { ok: true } | { ok: false; error: string };

const orNull = (v: string | undefined | null): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

export async function createCampaign(input: CampaignInput): Promise<CampaignMutationResult> {
  await requireUser();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  try {
    const campaign = await prisma.campaign.create({
      data: {
        nameEn: d.nameEn,
        nameAr: d.nameAr,
        occasion: orNull(d.occasion),
        startsAt: new Date(d.startsAt),
        endsAt: new Date(d.endsAt),
        isActive: d.isActive,
        bundles: {
          create: d.bundles.map((b) => ({
            nameEn: b.nameEn,
            nameAr: b.nameAr,
            discountType: b.discountType,
            discountValue: toDecimal(b.discountValue),
            minOrderAmount:
              b.minOrderAmount && b.minOrderAmount.trim() ? toDecimal(b.minOrderAmount) : null,
            items: {
              create: b.items.map((item) => ({
                productVariantId: item.productVariantId,
                quantity: item.quantity,
              })),
            },
          })),
        },
      },
      select: { id: true },
    });
    revalidatePath("/campaigns");
    return { ok: true, campaignId: campaign.id };
  } catch (e) {
    console.error("[campaigns] createCampaign failed:", e);
    return { ok: false, error: "unknown" };
  }
}

export async function updateCampaign(input: UpdateCampaignInput): Promise<CampaignMutationResult> {
  await requireUser();
  const parsed = updateCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  const existing = await prisma.campaign.findUnique({ where: { id: d.id }, select: { id: true } });
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await prisma.$transaction(async (tx) => {
      // Replace bundles wholesale — delete existing, re-create
      await tx.bundle.deleteMany({ where: { campaignId: d.id } });

      await tx.campaign.update({
        where: { id: d.id },
        data: {
          nameEn: d.nameEn,
          nameAr: d.nameAr,
          occasion: orNull(d.occasion),
          startsAt: new Date(d.startsAt),
          endsAt: new Date(d.endsAt),
          isActive: d.isActive,
          bundles: {
            create: d.bundles.map((b) => ({
              nameEn: b.nameEn,
              nameAr: b.nameAr,
              discountType: b.discountType,
              discountValue: toDecimal(b.discountValue),
              minOrderAmount:
                b.minOrderAmount && b.minOrderAmount.trim() ? toDecimal(b.minOrderAmount) : null,
              items: {
                create: b.items.map((item) => ({
                  productVariantId: item.productVariantId,
                  quantity: item.quantity,
                })),
              },
            })),
          },
        },
      });
    });
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${d.id}`);
    return { ok: true, campaignId: d.id };
  } catch (e) {
    console.error("[campaigns] updateCampaign failed:", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { ok: false, error: "variantRequired" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function deleteCampaign(id: string): Promise<DeleteResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };
  try {
    await prisma.campaign.delete({ where: { id } });
    revalidatePath("/campaigns");
    return { ok: true };
  } catch (e) {
    console.error("[campaigns] deleteCampaign failed:", e);
    return { ok: false, error: "unknown" };
  }
}
