"use server";

import { getGeminiClient, GEMINI_MODEL } from "./gemini";

export interface CartItem {
  name: string;
  quantity: number;
  price: string;
}

export interface GenerateCartRecoveryInput {
  customerName: string;
  items: CartItem[];
  subtotal: string;
  recoveryLink: string;
}

export type GenerateCartRecoveryResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function generateCartRecoveryMessage(
  input: GenerateCartRecoveryInput,
): Promise<GenerateCartRecoveryResult> {
  try {
    const client = getGeminiClient();

    const itemsList = input.items
      .map((i) => `• ${i.name} × ${i.quantity} — ${i.price} ريال`)
      .join("\n");

    const prompt = `أنتِ مختصة تسويق في دار الأميرات، متجر جمال سعودي فاخر.

اكتبي رسالة واتساب شخصية لاسترداد العميلة التي تركت سلة التسوق.

بيانات العميلة:
- الاسم: ${input.customerName}
- المنتجات في السلة:
${itemsList}
- إجمالي السلة: ${input.subtotal} ريال
- رابط الاسترداد: ${input.recoveryLink}

المتطلبات:
1. اكتبي الرسالة بالعربية الفصحى الودودة.
2. خاطبي العميلة باسمها.
3. ذكّري بالمنتجات المتروكة بأسلوب مشوّق.
4. أضيفي إحساسًا بالإلحاح اللطيف (مثل: المخزون محدود، أو العرض مؤقت).
5. ضعي رابط الاسترداد في نهاية الرسالة.
6. لا تتجاوزي 300 كلمة، وابدئي بـ "السلام عليكم" وانهي بـ "فريق دار الأميرات".

أجيبي برسالة الواتساب فقط، بدون أي نص إضافي.`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const message = response.text?.trim() ?? "";
    if (!message) throw new Error("Empty response from AI");

    return { ok: true, message };
  } catch (err) {
    console.error("[AI] generateCartRecoveryMessage failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
