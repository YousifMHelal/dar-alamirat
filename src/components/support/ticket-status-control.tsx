"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/ui/toast";
import { updateTicketStatus } from "@/lib/support/actions";
import type { TicketStatus } from "@/lib/support/queries";

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function TicketStatusControl({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const t = useTranslations("support");
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const onChange = (next: TicketStatus) => {
    if (next === status) return;
    startTransition(async () => {
      const res = await updateTicketStatus({ ticketId, status: next });
      if (res.ok) {
        toast(t("form.statusUpdated"), "success");
        router.refresh();
      } else {
        toast(t(`form.errors.${res.error}` as never), "error");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
      <select
        value={status}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value as TicketStatus)}
        className="border-input bg-surface text-foreground h-10 rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
