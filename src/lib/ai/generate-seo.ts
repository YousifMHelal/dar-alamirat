"use server";

import { getGeminiClient, GEMINI_MODEL } from "./gemini";

export interface GenerateSeoInput {
  nameEn: string;
  nameAr: string;
  brand: string;
  category: string;
  sku: string;
}

export type GenerateSeoResult =
  | { ok: true; metaTitle: string; metaDescription: string; keywords: string }
  | { ok: false; error: string };

export async function generateProductSeo(input: GenerateSeoInput): Promise<GenerateSeoResult> {
  try {
    const client = getGeminiClient();

    const prompt = `You are an SEO specialist for Dar Al-Amirat, a premium Saudi beauty retailer.

Generate SEO metadata for this product:
- English Name: ${input.nameEn}
- Arabic Name: ${input.nameAr}
- Brand: ${input.brand}
- Category: ${input.category}
- SKU: ${input.sku}

Requirements:
1. metaTitle: English, under 60 characters, include brand and product name. Format: "Product Name | Brand"
2. metaDescription: English, 120–160 characters. Highlight beauty benefits and premium quality. Engaging, click-worthy.
3. keywords: Comma-separated English keywords, 6–10 terms. Include brand, category, product name, and relevant beauty terms.

Respond ONLY with valid JSON, no extra text:
{
  "metaTitle": "...",
  "metaDescription": "...",
  "keywords": "..."
}`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = response.text?.trim() ?? "";
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(json) as {
      metaTitle: string;
      metaDescription: string;
      keywords: string;
    };

    if (!parsed.metaTitle || !parsed.metaDescription || !parsed.keywords) {
      throw new Error("Incomplete response from AI");
    }

    return {
      ok: true,
      metaTitle: parsed.metaTitle.trim().slice(0, 120),
      metaDescription: parsed.metaDescription.trim().slice(0, 320),
      keywords: parsed.keywords.trim().slice(0, 300),
    };
  } catch (err) {
    console.error("[AI] generateProductSeo failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
