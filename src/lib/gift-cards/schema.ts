import { z } from "zod";

const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "valueInvalid")
  .refine((v) => Number(v) > 0, "valueInvalid");

const codePattern = /^[A-Z0-9_-]+$/;

export const giftCardSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "codeRequired")
    .max(40)
    .regex(codePattern, "codeInvalid"),
  initialValue: moneyString,
  customerId: z.string().trim().optional().or(z.literal("")),
  expiresAt: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "dateInvalid")
    .optional()
    .or(z.literal("")),
});

export type GiftCardInput = z.infer<typeof giftCardSchema>;
