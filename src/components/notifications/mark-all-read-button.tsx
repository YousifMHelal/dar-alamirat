"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, CheckCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { markAllNotificationsRead } from "@/lib/notifications/actions";

export function MarkAllReadButton() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await markAllNotificationsRead();
      if (res.ok) {
        toast(t("allMarkedRead"), "success");
        router.refresh();
      } else {
        toast(t(`errors.${res.error}` as never), "error");
      }
    });
  };

  return (
    <Button variant="outline" onClick={onClick} disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
      {t("markAllRead")}
    </Button>
  );
}
