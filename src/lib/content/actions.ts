"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { BANNERS_KEY, APP_LAYOUT_KEY } from "./queries";
import {
  saveBannersSchema,
  saveLayoutSchema,
  type SaveBannersInput,
  type SaveLayoutInput,
} from "./schema";

/**
 * Content mutations. Both the banner list and the app layout are upserted as
 * a single JSON Setting row, validated authoritatively with Zod first. The
 * order of items in the arrays IS the display/sort order, so reordering on
 * the client is persisted simply by saving the reordered array.
 */

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveBanners(input: SaveBannersInput): Promise<SaveResult> {
  await requireUser();
  const parsed = saveBannersSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  try {
    await prisma.setting.upsert({
      where: { key: BANNERS_KEY },
      update: { valueJson: parsed.data },
      create: { key: BANNERS_KEY, valueJson: parsed.data },
    });
    revalidatePath("/content");
    return { ok: true };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function saveAppLayout(input: SaveLayoutInput): Promise<SaveResult> {
  await requireUser();
  const parsed = saveLayoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  try {
    await prisma.setting.upsert({
      where: { key: APP_LAYOUT_KEY },
      update: { valueJson: parsed.data },
      create: { key: APP_LAYOUT_KEY, valueJson: parsed.data },
    });
    revalidatePath("/content");
    return { ok: true };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
