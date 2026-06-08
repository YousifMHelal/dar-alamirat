"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { ticketSchema, replySchema, statusUpdateSchema, type TicketInput, type ReplyInput, type StatusUpdateInput } from "./schema";

export type TicketMutationResult = { ok: true; ticketId: string } | { ok: false; error: string };
export type SimpleResult = { ok: true } | { ok: false; error: string };

export async function createTicket(input: TicketInput): Promise<TicketMutationResult> {
  await requireUser();
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  const ticket = await prisma.supportTicket.create({
    data: {
      subject: d.subject,
      body: d.body,
      priority: d.priority,
      customerId: d.customerId && d.customerId.trim() ? d.customerId : null,
    },
    select: { id: true },
  });
  revalidatePath("/support");
  return { ok: true, ticketId: ticket.id };
}

export async function addTicketReply(input: ReplyInput): Promise<SimpleResult> {
  const user = await requireUser();
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  const ticket = await prisma.supportTicket.findUnique({ where: { id: d.ticketId }, select: { id: true, status: true } });
  if (!ticket) return { ok: false, error: "notFound" };

  await prisma.$transaction([
    prisma.ticketReply.create({ data: { ticketId: d.ticketId, authorId: user.id, body: d.body } }),
    prisma.supportTicket.update({
      where: { id: d.ticketId },
      data: { status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status, assignedToId: user.id },
    }),
  ]);

  revalidatePath(`/support/${d.ticketId}`);
  revalidatePath("/support");
  return { ok: true };
}

export async function updateTicketStatus(input: StatusUpdateInput): Promise<SimpleResult> {
  await requireUser();
  const parsed = statusUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const d = parsed.data;

  const ticket = await prisma.supportTicket.findUnique({ where: { id: d.ticketId }, select: { id: true } });
  if (!ticket) return { ok: false, error: "notFound" };

  await prisma.supportTicket.update({ where: { id: d.ticketId }, data: { status: d.status } });
  revalidatePath(`/support/${d.ticketId}`);
  revalidatePath("/support");
  return { ok: true };
}
