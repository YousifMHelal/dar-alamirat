"use server";

import { getGeminiClient, GEMINI_MODEL } from "./gemini";

export type ReviewSentimentValue = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface AnalyzeReviewSentimentInput {
  body: string;
  title?: string | null;
  rating: number;
}

export type AnalyzeReviewSentimentResult =
  | { ok: true; sentiment: ReviewSentimentValue; themes: string[] }
  | { ok: false; error: string };

export async function analyzeReviewSentiment(
  input: AnalyzeReviewSentimentInput
): Promise<AnalyzeReviewSentimentResult> {
  try {
    const client = getGeminiClient();

    const reviewText = [input.title ? `Title: ${input.title}` : null, `Body: ${input.body}`]
      .filter(Boolean)
      .join("\n");

    const prompt = `You are a sentiment analysis assistant for Dar Al-Amirat, a premium Saudi beauty and cosmetics brand.

Analyze the following customer review (star rating: ${input.rating}/5):

${reviewText}

Tasks:
1. Classify the overall sentiment as exactly one of: POSITIVE, NEUTRAL, or NEGATIVE.
2. Extract 1-2 concise theme tags that describe the main topics of the review (e.g. "packaging", "scent", "delivery", "texture", "value", "customer service", "quality", "longevity").
   - Tags must be lowercase single words or short hyphenated phrases (max 2 words).
   - Only use themes that are explicitly mentioned or strongly implied in the review.
   - Return at most 2 tags.

Respond ONLY with valid JSON in this exact format, no extra text:
{
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "themes": ["tag1", "tag2"]
}`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = response.text?.trim() ?? "";
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(json) as { sentiment: ReviewSentimentValue; themes: string[] };

    if (!["POSITIVE", "NEUTRAL", "NEGATIVE"].includes(parsed.sentiment)) {
      throw new Error("Invalid sentiment value from AI");
    }

    const themes = Array.isArray(parsed.themes)
      ? parsed.themes.slice(0, 2).map((t: string) => String(t).toLowerCase().trim())
      : [];

    return { ok: true, sentiment: parsed.sentiment, themes };
  } catch (err) {
    console.error("[AI] analyzeReviewSentiment failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
