import { z } from "zod";

// Commission as a percentage, 0–100 with up to 2 dp.
const rateString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "rateInvalid")
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, "rateInvalid");

// Tracking code: uppercase letters/numbers/dashes, normalised before save.
const codeString = z
  .string()
  .trim()
  .min(3, "codeRequired")
  .max(32, "codeTooLong")
  .regex(/^[A-Za-z0-9-]+$/, "codeInvalid");

export const affiliateSchema = z.object({
  name: z.string().trim().min(1, "nameRequired"),
  handle: z.string().trim().min(1, "handleRequired"),
  channel: z.enum(["SNAPCHAT", "INSTAGRAM", "TIKTOK", "YOUTUBE", "OTHER"]),
  code: codeString,
  email: z.string().trim().email("emailInvalid").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  commissionRate: rateString,
  status: z.enum(["ACTIVE", "PAUSED", "ENDED"]).default("ACTIVE"),
  contractTerms: z.string().trim().optional().or(z.literal("")),
});

export const updateAffiliateSchema = affiliateSchema.extend({
  id: z.string().cuid(),
});

export type AffiliateInput = z.infer<typeof affiliateSchema>;
export type UpdateAffiliateInput = z.infer<typeof updateAffiliateSchema>;
