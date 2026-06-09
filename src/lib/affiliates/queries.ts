import { prisma } from "@/lib/prisma";

export const AFFILIATES_PAGE_SIZE = 20;

export type AffiliateStatus = "ACTIVE" | "PAUSED" | "ENDED";
export type AffiliateChannel = "SNAPCHAT" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "OTHER";

export async function listAffiliates({ page = 1 }: { page?: number }) {
  const skip = (Math.max(1, page) - 1) * AFFILIATES_PAGE_SIZE;
  const [rows, total] = await Promise.all([
    prisma.affiliate.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: AFFILIATES_PAGE_SIZE,
      include: {
        conversions: {
          select: { netRevenue: true, commission: true, isNewCustomer: true },
        },
      },
    }),
    prisma.affiliate.count(),
  ]);

  return {
    rows: rows.map((a) => {
      const conversionCount = a.conversions.length;
      const revenue = a.conversions.reduce((sum, c) => sum + Number(c.netRevenue), 0);
      const commission = a.conversions.reduce((sum, c) => sum + Number(c.commission), 0);
      const newCustomers = a.conversions.filter((c) => c.isNewCustomer).length;
      return {
        id: a.id,
        name: a.name,
        handle: a.handle,
        channel: a.channel as AffiliateChannel,
        code: a.code,
        commissionRate: a.commissionRate.toString(),
        status: a.status as AffiliateStatus,
        conversionCount,
        revenue,
        commission,
        newCustomers,
      };
    }),
    total,
    page: Math.max(1, page),
    pageCount: Math.max(1, Math.ceil(total / AFFILIATES_PAGE_SIZE)),
  };
}

export type AffiliateListRow = Awaited<ReturnType<typeof listAffiliates>>["rows"][number];

export async function getAffiliateDetail(id: string) {
  const a = await prisma.affiliate.findUnique({
    where: { id },
    include: {
      conversions: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { order: { select: { orderNumber: true } } },
      },
    },
  });
  if (!a) return null;

  const revenue = a.conversions.reduce((sum, c) => sum + Number(c.netRevenue), 0);
  const commission = a.conversions.reduce((sum, c) => sum + Number(c.commission), 0);
  const newCustomers = a.conversions.filter((c) => c.isNewCustomer).length;

  return {
    id: a.id,
    name: a.name,
    handle: a.handle,
    channel: a.channel as AffiliateChannel,
    code: a.code,
    email: a.email ?? "",
    phone: a.phone ?? "",
    commissionRate: a.commissionRate.toString(),
    status: a.status as AffiliateStatus,
    contractTerms: a.contractTerms ?? "",
    stats: {
      conversionCount: a.conversions.length,
      revenue,
      commission,
      newCustomers,
    },
    conversions: a.conversions.map((c) => ({
      id: c.id,
      orderNumber: c.order.orderNumber,
      netRevenue: Number(c.netRevenue),
      commission: Number(c.commission),
      isNewCustomer: c.isNewCustomer,
      createdAt: c.createdAt,
    })),
  };
}

export type AffiliateDetail = NonNullable<Awaited<ReturnType<typeof getAffiliateDetail>>>;
