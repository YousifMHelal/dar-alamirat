"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "./index";
import { loginSchema } from "./schema";

/**
 * Result returned to the login form. On failure we return an i18n error
 * *key* (resolved client-side against `auth.errors.*`) rather than a
 * message, so errors stay bilingual and we never leak which of email vs
 * password was wrong (no account enumeration).
 */
export type LoginResult =
  | { ok: true }
  | { ok: false; error: "invalidCredentials" | "unknown" };

/** Verify credentials and establish the JWT session. */
export async function loginAction(
  email: string,
  password: string,
): Promise<LoginResult> {
  // Server-side validation mirrors the client form (defence in depth).
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) return { ok: false, error: "invalidCredentials" };

  try {
    // redirect:false → we handle navigation on the client so we can keep
    // the active locale and honour the ?from= return path.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { ok: true };
  } catch (error) {
    // CredentialsSignin = bad email/password; anything else is unexpected.
    if (error instanceof AuthError) {
      return {
        ok: false,
        error: error.type === "CredentialsSignin" ? "invalidCredentials" : "unknown",
      };
    }
    throw error;
  }
}

/** Clear the session. `redirectTo` keeps the user on the active locale. */
export async function logoutAction(redirectTo: string): Promise<void> {
  await signOut({ redirectTo });
}
