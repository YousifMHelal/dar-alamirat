import { z } from "zod";

/**
 * Zod schemas for every Orders mutation. Shared by the server actions
 * (authoritative validation) and the client form (same rules, instant
 * feedback). Coordinates are required because routing depends on them.
 */

// KSA mobile numbers, tolerant of spaces/dashes the user might type.
const phoneSchema = z
  .string()
  .trim()
  .min(6, "phoneTooShort")
  .max(20)
  .regex(/^[+0-9\s-]+$/, "phoneInvalid");

export const phoneLookupSchema = z.object({ phone: phoneSchema });

export const newCustomerSchema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(120),
  phone: phoneSchema,
  email: z.string().trim().email("emailInvalid").optional().or(z.literal("")),
  type: z.enum(["RETAIL", "B2B_SALON"]),
  city: z.string().trim().min(2, "cityRequired").max(80),
  addressLine: z.string().trim().min(3, "addressRequired").max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  pricingTierId: z.string().cuid().optional().nullable(),
  vatNumber: z.string().trim().max(50).optional().nullable(),
});

export const orderLineSchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.number().int().min(1, "quantityMin"),
});

export const createOrderSchema = z.object({
  customerId: z.string().cuid(),
  lines: z.array(orderLineSchema).min(1, "noLines"),
  paymentMethod: z.enum(["MADA", "TABBY", "TAMARA", "CREDIT_CARD", "B2B_CREDIT"]),
  redeemPoints: z.boolean().optional().default(false),
});

export type NewCustomerInput = z.infer<typeof newCustomerSchema>;
export type OrderLineInput = z.infer<typeof orderLineSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Normalise a phone for matching: strip spaces and dashes. */
export function normalisePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}
