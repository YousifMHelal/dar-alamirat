"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import bcrypt from "bcryptjs";
import { createStaffSchema, updateStaffSchema, type CreateStaffInput, type UpdateStaffInput } from "./schema";

export type StaffMutationResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("forbidden");
  return user;
}

export async function createStaff(input: CreateStaffInput): Promise<StaffMutationResult> {
  await requireAdmin();
  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const { name, email, password, role } = parsed.data;
  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({ data: { name, email, hashedPassword, role } });
    revalidatePath("/staff");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "emailTaken" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function updateStaff(input: UpdateStaffInput): Promise<StaffMutationResult> {
  await requireAdmin();
  const parsed = updateStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const { id, name, email, role, password } = parsed.data;
  const data: Prisma.UserUpdateInput = { name, email, role };
  if (password && password.length >= 8) {
    data.hashedPassword = await bcrypt.hash(password, 12);
  }

  try {
    await prisma.user.update({ where: { id }, data });
    revalidatePath("/staff");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "emailTaken" };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "notFound" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function toggleStaffActive(id: string): Promise<StaffMutationResult> {
  await requireAdmin();

  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { active: true } });
    await prisma.user.update({ where: { id }, data: { active: !user.active } });
    revalidatePath("/staff");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "notFound" };
    }
    return { ok: false, error: "unknown" };
  }
}
