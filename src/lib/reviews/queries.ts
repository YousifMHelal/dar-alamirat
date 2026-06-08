import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const REVIEWS_PAGE_SIZE = 15;

export interface ReviewsFilter {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  rating?: number;
  page: number;
}

function buildWhere(filter: ReviewsFilter): Prisma.ReviewWhereInput {
  const where: Prisma.ReviewWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.rating) where.rating = filter.rating;
  return where;
}

export async function listReviews(filter: ReviewsFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);

  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REVIEWS_PAGE_SIZE,
      take: REVIEWS_PAGE_SIZE,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        status: true,
        createdAt: true,
        product: { select: { id: true, nameAr: true, nameEn: true, brand: true } },
        customer: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      createdAt: r.createdAt,
      product: r.product,
      customer: r.customer,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE)),
  };
}

export type ReviewListRow = Awaited<ReturnType<typeof listReviews>>["rows"][number];

export interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  averageRating: number;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** Aggregate counters + rating distribution for the summary cards. */
export async function getReviewStats(): Promise<ReviewStats> {
  const [total, pending, approved, rejected, avg, breakdown] = await Promise.all([
    prisma.review.count(),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.review.count({ where: { status: "APPROVED" } }),
    prisma.review.count({ where: { status: "REJECTED" } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.review.groupBy({ by: ["rating"], _count: { rating: true } }),
  ]);

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const row of breakdown) {
    if (row.rating >= 1 && row.rating <= 5) {
      ratingBreakdown[row.rating as 1 | 2 | 3 | 4 | 5] = row._count.rating;
    }
  }

  return {
    total,
    pending,
    approved,
    rejected,
    averageRating: avg._avg.rating ?? 0,
    ratingBreakdown,
  };
}
