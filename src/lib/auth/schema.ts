import { z } from "zod";

/**
 * Login form schema — shared by the client form (inline validation) and
 * the server-side Credentials `authorize` (defence in depth). Keeping one
 * schema means the rules can never drift between the two sides.
 *
 * Messages are i18n *keys* (resolved by the login form against the
 * `auth.errors.*` namespace), not user-facing text, so validation stays
 * bilingual without coupling this module to a locale.
 */
export const loginSchema = z.object({
  email: z.string().trim().min(1, "emailRequired").email("emailInvalid"),
  password: z.string().min(1, "passwordRequired"),
});

export type LoginInput = z.infer<typeof loginSchema>;
