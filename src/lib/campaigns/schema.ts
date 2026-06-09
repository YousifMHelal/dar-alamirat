import { z } from "zod";

const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "discountValueInvalid")
  .refine((v) => Number(v) >= 0, "discountValueInvalid");

const dateString = (msg: string) =>
  z
    .string()
    .trim()
    .min(1, msg)
    .refine((v) => !Number.isNaN(Date.parse(v)), "dateInvalid");

const bundleItemSchema = z.object({
  id: z.string().optional(),
  productVariantId: z.string().min(1, "variantRequired"),
  quantity: z.coerce.number().int().min(1, "quantityMin"),
});

const bundleSchema = z.object({
  id: z.string().optional(),
  nameEn: z.string().trim().min(1, "bundleNameEnRequired"),
  nameAr: z.string().trim().min(1, "bundleNameArRequired"),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: moneyString,
  minOrderAmount: moneyString.optional().or(z.literal("")),
  items: z.array(bundleItemSchema).min(1, "noItems"),
});

export const campaignSchema = z
  .object({
    nameEn: z.string().trim().min(1, "nameEnRequired"),
    nameAr: z.string().trim().min(1, "nameArRequired"),
    occasion: z.string().trim().optional().or(z.literal("")),
    startsAt: dateString("startsAtRequired"),
    endsAt: dateString("endsAtRequired"),
    isActive: z.boolean().default(true),
    bundles: z.array(bundleSchema).default([]),
  })
  .refine((d) => Date.parse(d.endsAt) > Date.parse(d.startsAt), {
    message: "dateRangeInvalid",
    path: ["endsAt"],
  });

export const updateCampaignSchema = campaignSchema.extend({
  id: z.string().cuid(),
});

export type CampaignInput = z.infer<typeof campaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type BundleInput = z.infer<typeof bundleSchema>;
export type BundleItemInput = z.infer<typeof bundleItemSchema>;
