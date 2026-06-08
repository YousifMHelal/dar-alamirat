import { prisma } from "@/lib/prisma";

export const LOYALTY_TOP_SIZE = 20;

export async function getLoyaltySummary() {
  const [totalResult, topMembers, distribution] = await Promise.all([
    prisma.customer.aggregate({
      _sum: { loyaltyPoints: true },
      _count: { id: true },
    }),
    prisma.customer.findMany({
      where: { loyaltyPoints: { gt: 0 } },
      orderBy: { loyaltyPoints: "desc" },
      take: LOYALTY_TOP_SIZE,
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        loyaltyPoints: true,
      },
    }),
    // Distribution buckets: 0, 1-100, 101-500, 501-2000, 2000+
    Promise.all([
      prisma.customer.count({ where: { loyaltyPoints: 0 } }),
      prisma.customer.count({ where: { loyaltyPoints: { gte: 1, lte: 100 } } }),
      prisma.customer.count({ where: { loyaltyPoints: { gte: 101, lte: 500 } } }),
      prisma.customer.count({ where: { loyaltyPoints: { gte: 501, lte: 2000 } } }),
      prisma.customer.count({ where: { loyaltyPoints: { gt: 2000 } } }),
    ]),
  ]);

  return {
    totalPoints: totalResult._sum.loyaltyPoints ?? 0,
    totalMembers: totalResult._count.id,
    activeMembers: topMembers.length, // customers with > 0 pts
    topMembers,
    distribution: {
      zero: distribution[0],
      low: distribution[1],
      mid: distribution[2],
      high: distribution[3],
      elite: distribution[4],
    },
  };
}

export type LoyaltySummary = Awaited<ReturnType<typeof getLoyaltySummary>>;
