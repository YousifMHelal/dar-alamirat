import { prisma } from "@/lib/prisma";

export const TICKETS_PAGE_SIZE = 15;

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TicketsFilter {
  status?: TicketStatus;
  priority?: TicketPriority;
  page: number;
}

function buildWhere(filter: TicketsFilter) {
  const where: Record<string, unknown> = {};
  if (filter.status) where.status = filter.status;
  if (filter.priority) where.priority = filter.priority;
  return where;
}

export async function listTickets(filter: TicketsFilter) {
  const where = buildWhere(filter);
  const page = Math.max(1, filter.page);
  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * TICKETS_PAGE_SIZE,
      take: TICKETS_PAGE_SIZE,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { replies: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return {
    rows: rows.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt,
      customer: t.customer,
      assignedTo: t.assignedTo,
      replyCount: t._count.replies,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE)),
  };
}

export type TicketListRow = Awaited<ReturnType<typeof listTickets>>["rows"][number];

export async function getTicketDetail(id: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      body: true,
      status: true,
      priority: true,
      createdAt: true,
      customer: { select: { id: true, name: true, phone: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!ticket) return null;
  return ticket;
}

export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicketDetail>>>;

export interface TicketStats {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  avgResponseHours: number | null;
}

export async function getTicketStats(): Promise<TicketStats> {
  const [open, inProgress, resolved, closed, ticketsWithFirstReply] = await Promise.all([
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.supportTicket.count({ where: { status: "RESOLVED" } }),
    prisma.supportTicket.count({ where: { status: "CLOSED" } }),
    prisma.supportTicket.findMany({
      where: { replies: { some: {} } },
      select: { createdAt: true, replies: { orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } } },
      take: 200,
    }),
  ]);

  let avgResponseHours: number | null = null;
  if (ticketsWithFirstReply.length > 0) {
    const totalHours = ticketsWithFirstReply.reduce((sum, t) => {
      const first = t.replies[0];
      if (!first) return sum;
      return sum + (first.createdAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
    }, 0);
    avgResponseHours = Math.round((totalHours / ticketsWithFirstReply.length) * 10) / 10;
  }

  return { open, inProgress, resolved, closed, avgResponseHours };
}
