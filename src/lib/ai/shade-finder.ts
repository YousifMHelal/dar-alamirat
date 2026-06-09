"use server";

import { getGeminiClient, GEMINI_MODEL } from "./gemini";
import { prisma } from "@/lib/prisma";

export interface ShadeFinderInput {
  undertone: "cool" | "warm" | "neutral";
  depth: "fair" | "light" | "medium" | "tan" | "deep";
  coverage: "light" | "medium" | "full";
  finish: "matte" | "satin" | "dewy";
}

export interface ShadeRecommendation {
  variantId: string;
  variantSku: string;
  productNameEn: string;
  productNameAr: string;
  colorName: string | null;
  colorHex: string | null;
  brand: string;
  imageUrl: string | null;
  price: string;
  reasoning: string;
}

export type ShadeFinderResult =
  | { ok: true; recommendations: ShadeRecommendation[] }
  | { ok: false; error: string };

export async function findShades(input: ShadeFinderInput): Promise<ShadeFinderResult> {
  try {
    // Load foundation/concealer variants from catalog
    const variants = await prisma.productVariant.findMany({
      where: {
        product: {
          active: true,
          OR: [
            { category: { nameEn: { contains: "foundation", mode: "insensitive" } } },
            { category: { nameEn: { contains: "concealer", mode: "insensitive" } } },
            { category: { nameAr: { contains: "أساس", mode: "insensitive" } } },
            { category: { nameAr: { contains: "كونسيلر", mode: "insensitive" } } },
            { nameEn: { contains: "foundation", mode: "insensitive" } },
            { nameEn: { contains: "concealer", mode: "insensitive" } },
          ],
        },
      },
      select: {
        id: true,
        variantSku: true,
        colorName: true,
        colorHex: true,
        priceOverride: true,
        product: {
          select: {
            nameEn: true,
            nameAr: true,
            brand: true,
            basePrice: true,
            imageUrl: true,
            category: { select: { nameEn: true } },
          },
        },
      },
      take: 60,
    });

    if (variants.length === 0) {
      return { ok: false, error: "noCatalog" };
    }

    const catalogSummary = variants.map((v) => ({
      variantId: v.id,
      variantSku: v.variantSku,
      productNameEn: v.product.nameEn,
      productNameAr: v.product.nameAr,
      colorName: v.colorName ?? null,
      colorHex: v.colorHex ?? null,
      brand: v.product.brand,
      category: v.product.category.nameEn,
      price: v.priceOverride?.toString() ?? v.product.basePrice.toString(),
    }));

    const client = getGeminiClient();

    const prompt = `You are a professional beauty advisor for Dar Al-Amirat, a premium Saudi cosmetics retailer.

A customer or staff member has taken a shade-finder quiz with the following answers:
- Skin undertone: ${input.undertone}
- Skin depth: ${input.depth}
- Coverage preference: ${input.coverage}
- Finish preference: ${input.finish}

Here is the current foundation and concealer catalog (JSON):
${JSON.stringify(catalogSummary, null, 2)}

Select exactly 3 variants that are the best match for this profile. For each variant provide a concise 1-2 sentence reasoning in English explaining why it suits this skin profile.

Respond ONLY with valid JSON in this exact format, no extra text:
{
  "recommendations": [
    { "variantId": "...", "reasoning": "..." },
    { "variantId": "...", "reasoning": "..." },
    { "variantId": "...", "reasoning": "..." }
  ]
}`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = response.text?.trim() ?? "";
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(json) as {
      recommendations: Array<{ variantId: string; reasoning: string }>;
    };

    if (!Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
      throw new Error("No recommendations returned");
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const recommendations: ShadeRecommendation[] = parsed.recommendations
      .slice(0, 3)
      .map((rec) => {
        const v = variantMap.get(rec.variantId);
        if (!v) return null;
        return {
          variantId: v.id,
          variantSku: v.variantSku,
          productNameEn: v.product.nameEn,
          productNameAr: v.product.nameAr,
          colorName: v.colorName ?? null,
          colorHex: v.colorHex ?? null,
          brand: v.product.brand,
          imageUrl: v.product.imageUrl ?? null,
          price: (v.priceOverride ?? v.product.basePrice).toString(),
          reasoning: rec.reasoning,
        };
      })
      .filter((r): r is ShadeRecommendation => r !== null);

    return { ok: true, recommendations };
  } catch (err) {
    console.error("[AI] findShades failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
