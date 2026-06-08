"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { toDecimal } from "@/lib/money";
import { giftCardSchema, type GiftCardInput } from "./schema";

export type GiftCardMutationResult =
  | { ok: true; giftCardId: string }
  | { ok: false; error: string };

export type SimpleResult = { ok: true } | { ok: false; error: string };

export async function issueGiftCard(input: GiftCardInput): Promise<GiftCardMutationResult> {
  await requireUser();
  const parsed = giftCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;
  const value = toDecimal(d.initialValue);
  const customerId = d.customerId && d.customerId.trim() ? d.customerId : null;

  try {
    const card = await prisma.$transaction(async (tx) => {
      const created = await tx.giftCard.create({
        data: {
          code: d.code,
          initialValue: value,
          remainingBalance: value,
          status: "ACTIVE",
          issuedToId: customerId,
          expiresAt: d.expiresAt && d.expiresAt.trim() ? new Date(d.expiresAt) : null,
        },
        select: { id: true },
      });
      await tx.giftCardTransaction.create({
        data: { giftCardId: created.id, amount: value, type: "ISSUE" },
      });
      return created;
    });

    revalidatePath("/gift-cards");
    return { ok: true, giftCardId: card.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "codeTaken" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function disableGiftCard(id: string): Promise<SimpleResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };

  const card = await prisma.giftCard.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!card) return { ok: false, error: "notFound" };
  if (card.status !== "ACTIVE") return { ok: false, error: "notActive" };

  await prisma.giftCard.update({ where: { id }, data: { status: "DISABLED" } });
  revalidatePath(`/gift-cards/${id}`);
  revalidatePath("/gift-cards");
  return { ok: true };
}
