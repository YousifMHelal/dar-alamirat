import { prisma } from "@/lib/prisma";

export const LOYALTY_TOP_SIZE = 20;

export async function getLoyaltySummary() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalResult, topMembers, distribution, monthlyStats] = await Promise.all([
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
    // Monthly stats: sum of points awarded (via DELIVERED orders) and redeemed.
    // Points awarded = subtotal of orders that reached DELIVERED this month.
    // Points redeemed = sum of pointsRedeemed on orders placed this month.
    prisma.order.aggregate({
      where: { status: "DELIVERED", updatedAt: { gte: startOfMonth } },
      _sum: { subtotal: true },
    }).then((r) => ({
      awarded: Math.floor(Number(r._sum.subtotal ?? 0)),
    })).then(async (awarded) => {
      const redeemed = await prisma.order.aggregate({
        where: { pointsRedeemed: { gt: 0 }, createdAt: { gte: startOfMonth } },
        _sum: { pointsRedeemed: true },
      });
      return {
        pointsAwardedThisMonth: awarded.awarded,
        pointsRedeemedThisMonth: redeemed._sum.pointsRedeemed ?? 0,
      };
    }),
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
    pointsAwardedThisMonth: monthlyStats.pointsAwardedThisMonth,
    pointsRedeemedThisMonth: monthlyStats.pointsRedeemedThisMonth,
  };
}

export type LoyaltySummary = Awaited<ReturnType<typeof getLoyaltySummary>>;
