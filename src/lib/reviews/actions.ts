"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import type { ReviewSentimentValue } from "@/lib/ai/analyze-review-sentiment";

export type ReviewSentimentResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveReviewSentiment(
  id: string,
  sentiment: ReviewSentimentValue,
  themes: string[]
): Promise<ReviewSentimentResult> {
  await requireUser();
  if (!id) return { ok: false, error: "invalid" };

  const review = await prisma.review.findUnique({ where: { id }, select: { id: true } });
  if (!review) return { ok: false, error: "notFound" };

  await prisma.review.update({
    where: { id },
    data: { sentiment, themes },
  });

  revalidatePath("/reviews");
  return { ok: true };
}
