import { prisma } from "@/lib/prisma";

export const CAMPAIGNS_PAGE_SIZE = 20;

export async function listCampaigns({ page = 1 }: { page?: number }) {
  const skip = (Math.max(1, page) - 1) * CAMPAIGNS_PAGE_SIZE;
  const [rows, total] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: CAMPAIGNS_PAGE_SIZE,
      include: {
        _count: { select: { bundles: true } },
      },
    }),
    prisma.campaign.count(),
  ]);

  const now = new Date();
  return {
    rows: rows.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      occasion: c.occasion,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      isActive: c.isActive,
      bundleCount: c._count.bundles,
      status: deriveCampaignStatus(c.isActive, c.startsAt, c.endsAt, now),
    })),
    total,
    page: Math.max(1, page),
    pageCount: Math.max(1, Math.ceil(total / CAMPAIGNS_PAGE_SIZE)),
  };
}

export type CampaignListRow = Awaited<ReturnType<typeof listCampaigns>>["rows"][number];
export type CampaignStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED";

export function deriveCampaignStatus(
  isActive: boolean,
  startsAt: Date,
  endsAt: Date,
  now = new Date(),
): CampaignStatus {
  if (!isActive || now > endsAt) return "EXPIRED";
  if (now < startsAt) return "SCHEDULED";
  return "ACTIVE";
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function getCampaignDetail(id: string) {
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: {
      bundles: {
        include: {
          items: {
            include: {
              productVariant: {
                include: { product: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!c) return null;

  return {
    id: c.id,
    nameEn: c.nameEn,
    nameAr: c.nameAr,
    occasion: c.occasion ?? "",
    startsAt: toLocalInput(c.startsAt),
    endsAt: toLocalInput(c.endsAt),
    isActive: c.isActive,
    bundles: c.bundles.map((b) => ({
      id: b.id,
      nameEn: b.nameEn,
      nameAr: b.nameAr,
      discountType: b.discountType as "PERCENTAGE" | "FIXED",
      discountValue: b.discountValue.toString(),
      minOrderAmount: b.minOrderAmount?.toString() ?? "",
      items: b.items.map((item) => ({
        id: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        variantLabel: [
          item.productVariant.product.nameEn,
          item.productVariant.colorName,
          item.productVariant.variantSku,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    })),
  };
}

export type CampaignDetail = NonNullable<Awaited<ReturnType<typeof getCampaignDetail>>>;

/**
 * Find active bundles whose items are a subset of the given variant IDs.
 * Used by the order form to surface "bundle discount available" suggestions.
 */
export async function findMatchingBundles(variantIds: string[]) {
  if (variantIds.length === 0) return [];

  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    include: {
      bundles: {
        include: { items: true },
      },
    },
  });

  const variantSet = new Set(variantIds);

  const matches: Array<{
    bundleId: string;
    bundleNameEn: string;
    bundleNameAr: string;
    campaignNameEn: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: string;
    minOrderAmount: string | null;
  }> = [];

  for (const campaign of campaigns) {
    for (const bundle of campaign.bundles) {
      const allPresent = bundle.items.every((item) => variantSet.has(item.productVariantId));
      if (allPresent && bundle.items.length > 0) {
        matches.push({
          bundleId: bundle.id,
          bundleNameEn: bundle.nameEn,
          bundleNameAr: bundle.nameAr,
          campaignNameEn: campaign.nameEn,
          discountType: bundle.discountType as "PERCENTAGE" | "FIXED",
          discountValue: bundle.discountValue.toString(),
          minOrderAmount: bundle.minOrderAmount?.toString() ?? null,
        });
      }
    }
  }

  return matches;
}
