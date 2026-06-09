"use server";

import { getGeminiClient, GEMINI_MODEL } from "./gemini";

export interface GenerateDescriptionInput {
  nameEn: string;
  nameAr: string;
  brand: string;
  category: string;
  capacity?: string;
}

export type GenerateDescriptionResult =
  | { ok: true; descriptionEn: string; descriptionAr: string }
  | { ok: false; error: string };

export async function generateProductDescription(
  input: GenerateDescriptionInput
): Promise<GenerateDescriptionResult> {
  try {
    const client = getGeminiClient();

    const prompt = `You are a copywriter for Dar Al-Amirat, a premium Saudi beauty and cosmetics retailer.

Write a product description for the following beauty product:
- English Name: ${input.nameEn}
- Arabic Name: ${input.nameAr}
- Brand: ${input.brand}
- Category: ${input.category}
${input.capacity ? `- Size/Capacity: ${input.capacity}` : ""}

Requirements:
1. Write two descriptions: one in English, one in Arabic.
2. Each description should be 2-3 sentences, engaging and elegant in tone.
3. Highlight the product's beauty benefits and premium quality.
4. The Arabic description must be in Modern Standard Arabic (فصحى), written right-to-left.
5. Keep both descriptions under 300 characters.

Respond ONLY with valid JSON in this exact format, no extra text:
{
  "descriptionEn": "...",
  "descriptionAr": "..."
}`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = response.text?.trim() ?? "";

    // Strip markdown code fences if present
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(json) as { descriptionEn: string; descriptionAr: string };

    if (!parsed.descriptionEn || !parsed.descriptionAr) {
      throw new Error("Incomplete response from AI");
    }

    return {
      ok: true,
      descriptionEn: parsed.descriptionEn.trim(),
      descriptionAr: parsed.descriptionAr.trim(),
    };
  } catch (err) {
    console.error("[AI] generateProductDescription failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
