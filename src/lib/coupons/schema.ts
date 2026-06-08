import { z } from "zod";

/**
 * Zod schemas for Coupon mutations — authoritative on the server and
 * mirrored by the client form. Money fields arrive as strings from the
 * form and are validated as non-negative decimals; the action converts
 * them to Prisma.Decimal. Dates arrive as ISO datetime-local strings.
 */

const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "valueInvalid")
  .refine((v) => Number(v) >= 0, "valueInvalid");

const codePattern = /^[A-Z0-9_-]+$/;

const dateString = z
  .string()
  .trim()
  .min(1, "startsAtRequired")
  .refine((v) => !Number.isNaN(Date.parse(v)), "dateInvalid");

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "codeRequired")
      .max(40)
      .regex(codePattern, "codeInvalid"),
    description: z.string().trim().max(280).optional().or(z.literal("")),
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    value: moneyString,
    minOrder: moneyString.optional().or(z.literal("")),
    usageLimit: z
      .string()
      .trim()
      .regex(/^\d+$/, "usageLimitInvalid")
      .optional()
      .or(z.literal("")),
    startsAt: dateString,
    endsAt: z
      .string()
      .trim()
      .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "dateInvalid")
      .optional()
      .or(z.literal("")),
    status: z.enum(["ACTIVE", "SCHEDULED", "EXPIRED", "DISABLED"]),
  })
  .refine(
    (d) => d.type !== "PERCENTAGE" || Number(d.value) <= 100,
    { message: "percentageOutOfRange", path: ["value"] },
  )
  .refine(
    (d) => !d.endsAt || Date.parse(d.endsAt) > Date.parse(d.startsAt),
    { message: "endBeforeStart", path: ["endsAt"] },
  );

export const updateCouponSchema = couponSchema.extend({
  id: z.string().cuid(),
});

export type CouponInput = z.infer<typeof couponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
