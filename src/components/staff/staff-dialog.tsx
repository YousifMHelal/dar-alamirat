"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, UserPlus, X, AlertTriangle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createStaff, updateStaff, toggleStaffActive } from "@/lib/staff/actions";
import type { StaffListRow } from "@/lib/staff/queries";

const ERROR_KEYS = ["nameRequired", "emailInvalid", "passwordTooShort", "emailTaken", "notFound", "unknown"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

const selectClass =
  "border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

function translateError(t: ReturnType<typeof useTranslations<"staff">>, error: string): string {
  const key: ErrorKey = (ERROR_KEYS as readonly string[]).includes(error) ? (error as ErrorKey) : "unknown";
  return t(`form.errors.${key}` as Parameters<typeof t>[0]);
}

type Props = {
  staff?: StaffListRow;
  trigger: React.ReactNode;
};

export function StaffDialog({ staff, trigger }: Props) {
  const t = useTranslations("staff");
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(staff);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: staff?.name ?? "",
    email: staff?.email ?? "",
    role: (staff?.role ?? "MANAGER") as "ADMIN" | "MANAGER" | "B2B_SALON",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isToggling, startToggle] = useTransition();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const resetAndClose = () => {
    setError(null);
    if (!isEdit) setForm({ name: "", email: "", role: "MANAGER", password: "" });
    setOpen(false);
  };

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const res = isEdit && staff
        ? await updateStaff({ id: staff.id, name: form.name, email: form.email, role: form.role, password: form.password || undefined })
        : await createStaff({ name: form.name, email: form.email, role: form.role, password: form.password });

      if (res.ok) {
        toast(isEdit ? t("form.saved") : t("form.created"), "success");
        resetAndClose();
        router.refresh();
      } else {
        const msg = translateError(t, res.error);
        setError(msg);
        toast(msg, "error");
      }
    });
  };

  const onToggleActive = () => {
    if (!staff) return;
    startToggle(async () => {
      const res = await toggleStaffActive(staff.id);
      if (res.ok) {
        toast(staff.active ? t("form.deactivated") : t("form.activated"), "success");
        resetAndClose();
        router.refresh();
      } else {
        toast(translateError(t, res.error), "error");
      }
    });
  };

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger}
      </span>

      <dialog
        ref={dialogRef}
        onClick={(e) => { if (e.target === dialogRef.current) resetAndClose(); }}
        className="bg-card border-border shadow-lg rounded-2xl border p-0 w-full max-w-lg m-auto backdrop:bg-black/50 open:flex open:flex-col"
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-foreground text-base font-semibold">
            {isEdit ? t("form.editTitle") : t("form.addTitle")}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={resetAndClose} aria-label={t("form.close")}>
            <X />
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5">
          <div>
            <Label htmlFor="staff-name">{t("form.name")}</Label>
            <Input
              id="staff-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("form.namePlaceholder")}
            />
          </div>

          <div>
            <Label htmlFor="staff-email">{t("form.email")}</Label>
            <Input
              id="staff-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              dir="ltr"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <Label htmlFor="staff-role">{t("form.role")}</Label>
            <select
              id="staff-role"
              value={form.role}
              onChange={(e) => set("role", e.target.value as typeof form.role)}
              className={selectClass}
            >
              <option value="ADMIN">{t("roles.ADMIN")}</option>
              <option value="MANAGER">{t("roles.MANAGER")}</option>
              <option value="B2B_SALON">{t("roles.B2B_SALON")}</option>
            </select>
          </div>

          <div>
            <Label htmlFor="staff-password">
              {isEdit ? t("form.passwordOptional") : t("form.password")}
            </Label>
            <Input
              id="staff-password"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              dir="ltr"
              placeholder={isEdit ? t("form.passwordOptionalPlaceholder") : ""}
              autoComplete="new-password"
            />
            {isEdit && (
              <p className="text-muted-foreground mt-1 text-xs">{t("form.passwordHint")}</p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-sm">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-border flex items-center justify-between gap-3 border-t px-5 py-4">
          <div className="flex gap-2">
            <Button onClick={onSave} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : isEdit ? <Save /> : <UserPlus />}
              {isPending
                ? isEdit ? t("form.saving") : t("form.creating")
                : isEdit ? t("form.save") : t("form.create")}
            </Button>
            <Button variant="outline" onClick={resetAndClose} disabled={isPending}>
              {t("form.cancel")}
            </Button>
          </div>

          {isEdit && staff && (
            <Button
              variant="ghost"
              onClick={onToggleActive}
              disabled={isToggling}
              className={staff.active ? "text-destructive hover:bg-destructive/10" : "text-success hover:bg-success/10"}
            >
              {isToggling && <Loader2 className="animate-spin" />}
              {staff.active ? t("form.deactivate") : t("form.activate")}
            </Button>
          )}
        </div>
      </dialog>
    </>
  );
}
