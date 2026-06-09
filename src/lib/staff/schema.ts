import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().min(1, "nameRequired").max(100),
  email: z.string().email("emailInvalid"),
  password: z.string().min(8, "passwordTooShort"),
  role: z.enum(["ADMIN", "MANAGER", "B2B_SALON"]),
});

export const updateStaffSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "nameRequired").max(100),
  email: z.string().email("emailInvalid"),
  role: z.enum(["ADMIN", "MANAGER", "B2B_SALON"]),
  password: z.string().min(8, "passwordTooShort").or(z.literal("")).optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
