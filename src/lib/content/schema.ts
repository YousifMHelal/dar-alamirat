import { z } from "zod";

/**
 * Zod schemas for the Content & App-Layout module. Both the storefront
 * banner slider and the mobile home-screen layout are persisted as JSON in
 * the Setting table (keys defined in queries.ts), so these schemas are the
 * authoritative shape for what gets stored and read back.
 */

/** A storefront promo banner / slide. */
export const bannerSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().trim().url("imageUrlInvalid").or(z.literal("")),
  titleAr: z.string().trim().max(120).optional().or(z.literal("")),
  titleEn: z.string().trim().max(120).optional().or(z.literal("")),
  link: z.string().trim().max(300).optional().or(z.literal("")),
  active: z.boolean(),
});

export const saveBannersSchema = z.object({
  banners: z.array(bannerSchema).max(20),
});

/**
 * A home-screen layout block. Two kinds:
 *   - "stories": a row of story circles (each with an image + label).
 *   - "categoryGrid": a grid block bound to catalog categories (by id), with
 *     a configurable column count.
 */
export const storyItemSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().trim().url("imageUrlInvalid").or(z.literal("")),
  labelAr: z.string().trim().max(40).optional().or(z.literal("")),
  labelEn: z.string().trim().max(40).optional().or(z.literal("")),
});

export const layoutBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("stories"),
    titleAr: z.string().trim().max(60).optional().or(z.literal("")),
    titleEn: z.string().trim().max(60).optional().or(z.literal("")),
    items: z.array(storyItemSchema).max(20),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("categoryGrid"),
    titleAr: z.string().trim().max(60).optional().or(z.literal("")),
    titleEn: z.string().trim().max(60).optional().or(z.literal("")),
    columns: z.number().int().min(2).max(4),
    categoryIds: z.array(z.string()).max(24),
  }),
]);

export const saveLayoutSchema = z.object({
  blocks: z.array(layoutBlockSchema).max(20),
});

export type Banner = z.infer<typeof bannerSchema>;
export type StoryItem = z.infer<typeof storyItemSchema>;
export type LayoutBlock = z.infer<typeof layoutBlockSchema>;
export type SaveBannersInput = z.infer<typeof saveBannersSchema>;
export type SaveLayoutInput = z.infer<typeof saveLayoutSchema>;
