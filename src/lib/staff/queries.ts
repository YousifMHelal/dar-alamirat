import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const STAFF_PAGE_SIZE = 15;

export interface StaffFilter {
  search?: string;
  role?: "ADMIN" | "MANAGER" | "B2B_SALON";
  page: number;
}

function buildWhere(filter: StaffFilter): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (filter.role) where.role = filter.role;
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listStaff(filter: StaffFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * STAFF_PAGE_SIZE,
      take: STAFF_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / STAFF_PAGE_SIZE)),
  };
}

export type StaffListRow = Awaited<ReturnType<typeof listStaff>>["rows"][number];
