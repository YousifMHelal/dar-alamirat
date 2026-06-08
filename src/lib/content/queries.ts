import { prisma } from "@/lib/prisma";
import { saveBannersSchema, saveLayoutSchema, type Banner, type LayoutBlock } from "./schema";

/**
 * Read-side access for the Content module. The storefront banners and the
 * mobile home-screen layout live as JSON blobs in the Setting table (one row
 * each). Reads parse the stored JSON through the same Zod schemas the writes
 * use, so a malformed/legacy row degrades to an empty list rather than
 * throwing.
 */

export const BANNERS_KEY = "content_banners";
export const APP_LAYOUT_KEY = "content_app_layout";

export async function getBanners(): Promise<Banner[]> {
  const row = await prisma.setting.findUnique({ where: { key: BANNERS_KEY } });
  if (!row) return [];
  const parsed = saveBannersSchema.safeParse(row.valueJson);
  return parsed.success ? parsed.data.banners : [];
}

export async function getAppLayout(): Promise<LayoutBlock[]> {
  const row = await prisma.setting.findUnique({ where: { key: APP_LAYOUT_KEY } });
  if (!row) return [];
  const parsed = saveLayoutSchema.safeParse(row.valueJson);
  return parsed.success ? parsed.data.blocks : [];
}

/** Categories for the home-screen category-grid block picker. */
export async function listCategoriesForLayout() {
  return prisma.category.findMany({
    orderBy: { nameEn: "asc" },
    select: { id: true, nameEn: true, nameAr: true, slug: true },
  });
}
