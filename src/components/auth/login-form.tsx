"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { loginAction } from "@/lib/auth/actions";
import { loginSchema } from "@/lib/auth/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** i18n keys under `auth.errors.*` — keeps t() calls strictly typed. */
type AuthErrorKey =
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "invalidCredentials"
  | "unknown";

type FieldErrors = { email?: AuthErrorKey; password?: AuthErrorKey };

/**
 * Login form (client). Validation runs through the shared Zod schema on
 * blur and again on submit; field errors are i18n keys resolved against
 * `auth.errors.*`. On success we navigate — locale-aware — to the `?from=`
 * path the middleware stashed, falling back to /overview. The form error
 * is a single generic message (no account enumeration).
 */
export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAutofill = () => {
    setEmail("admin@daralamirat.sa");
    setPassword("DarAlAmirat#2026");
    setFieldErrors({});
    setFormError(null);
  };

  /** Where to land after a successful sign-in (locale prefix stripped). */
  function destination(): string {
    const from = searchParams.get("from");
    if (!from) return "/overview";
    // The stored path includes the locale prefix; strip it so the
    // locale-aware router re-adds the active one.
    const withoutLocale = from.replace(/^\/(ar|en)(?=\/|$)/, "");
    return withoutLocale || "/overview";
  }

  function validate(values: { email: string; password: string }): FieldErrors {
    const result = loginSchema.safeParse(values);
    if (result.success) return {};
    const errs: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      // The schema's messages ARE auth error keys (see lib/auth/schema.ts).
      const message = issue.message as AuthErrorKey;
      if (key === "email" && !errs.email) errs.email = message;
      if (key === "password" && !errs.password) errs.password = message;
    }
    return errs;
  }

  function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const errs = validate({ email, password });
    setFieldErrors(errs);
    setFormError(null);
    if (errs.email || errs.password) {
      // Focus the first invalid field for keyboard/screen-reader users.
      if (errs.email) emailRef.current?.focus();
      return;
    }

    startTransition(async () => {
      const result = await loginAction(email, password);
      if (result.ok) {
        router.replace(destination());
        router.refresh();
        return;
      }
      setFormError(t(`errors.${result.error}`));
    });
  }

  return (
    <form action={onSubmit} noValidate className="flex flex-col gap-5">
      {/* Form-level error (invalid credentials / unexpected) */}
      {formError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
        >
          {formError}
        </div>
      )}

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={emailId}
          className="text-foreground text-sm font-medium"
        >
          {t("emailLabel")}
        </label>
        <input
          ref={emailRef}
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
          onBlur={(e) =>
            setFieldErrors((prev) => ({
              ...prev,
              email: validate({
                email: e.target.value,
                password: "x",
              }).email,
            }))
          }
          className={cn(
            "bg-surface text-foreground placeholder:text-muted-foreground h-11 rounded-lg border px-3.5 text-sm transition-colors outline-none",
            "focus-visible:ring-ring focus-visible:border-primary focus-visible:ring-2",
            "text-start", // dir=ltr but logical start so RTL layout still aligns the label
            fieldErrors.email ? "border-destructive" : "border-border-strong",
          )}
        />
        {fieldErrors.email && (
          <p
            id={`${emailId}-error`}
            role="alert"
            className="text-destructive text-xs"
          >
            {t(`errors.${fieldErrors.email}`)}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={passwordId}
          className="text-foreground text-sm font-medium"
        >
          {t("passwordLabel")}
        </label>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={
              fieldErrors.password ? `${passwordId}-error` : undefined
            }
            onBlur={(e) =>
              setFieldErrors((prev) => ({
                ...prev,
                password: validate({
                  email: "x@x.com",
                  password: e.target.value,
                }).password,
              }))
            }
            className={cn(
              "bg-surface text-foreground placeholder:text-muted-foreground h-11 w-full rounded-lg border px-3.5 pr-11 text-sm transition-colors outline-none",
              "focus-visible:ring-ring focus-visible:border-primary focus-visible:ring-2",
              "text-start",
              fieldErrors.password
                ? "border-destructive"
                : "border-border-strong",
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            aria-pressed={showPassword}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg outline-none focus-visible:ring-2"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {fieldErrors.password && (
          <p
            id={`${passwordId}-error`}
            role="alert"
            className="text-destructive text-xs"
          >
            {t(`errors.${fieldErrors.password}`)}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isPending}
        onClick={handleAutofill}
        className="mt-1 w-full"
      >
        {t("autofillAdmin")}
      </Button>

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("signingIn")}
          </>
        ) : (
          <>
            <LogIn className="size-4 rtl:scale-x-[-1]" />
            {t("signIn")}
          </>
        )}
      </Button>
    </form>
  );
}
