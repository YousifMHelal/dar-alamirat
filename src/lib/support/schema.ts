import { z } from "zod";

export const ticketSchema = z.object({
  subject: z.string().trim().min(3, "subjectRequired").max(160, "subjectTooLong"),
  body: z.string().trim().min(10, "bodyRequired").max(4000, "bodyTooLong"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  customerId: z.string().cuid().optional().or(z.literal("")),
});

export type TicketInput = z.infer<typeof ticketSchema>;

export const replySchema = z.object({
  ticketId: z.string().cuid(),
  body: z.string().trim().min(2, "bodyRequired").max(4000, "bodyTooLong"),
});

export type ReplyInput = z.infer<typeof replySchema>;

export const statusUpdateSchema = z.object({
  ticketId: z.string().cuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;
