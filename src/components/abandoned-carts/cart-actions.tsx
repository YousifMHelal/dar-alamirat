"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, BellRing, CheckCircle2, Link2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { sendCartReminder, markCartRecovered } from "@/lib/abandoned-carts/actions";

export function CartActions({
  id,
  status,
  recoveryLink,
}: {
  id: string;
  status: "ACTIVE" | "RECOVERED" | "EXPIRED";
  recoveryLink: string;
}) {
  const t = useTranslations("abandonedCarts");
  const router = useRouter();
  const { toast } = useToast();
  const [isReminding, startReminder] = useTransition();
  const [isRecovering, startRecover] = useTransition();

  const onRemind = () => {
    startReminder(async () => {
      const res = await sendCartReminder(id);
      if (res.ok) {
        toast(t("actions.reminderSent"), "success");
        router.refresh();
      } else {
        toast(t(`actions.errors.${res.error}` as never), "error");
      }
    });
  };

  const onRecover = () => {
    startRecover(async () => {
      const res = await markCartRecovered(id);
      if (res.ok) {
        toast(t("actions.markedRecovered"), "success");
        router.refresh();
      } else {
        toast(t(`actions.errors.${res.error}` as never), "error");
      }
    });
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(recoveryLink);
      toast(t("actions.linkCopied"), "success");
    } catch {
      toast(t("actions.errors.unknown"), "error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="ghost" size="sm" onClick={onCopyLink} title={t("actions.copyLink")}>
        <Link2 />
      </Button>
      {status === "ACTIVE" && (
        <>
          <Button variant="outline" size="sm" onClick={onRemind} disabled={isReminding}>
            {isReminding ? <Loader2 className="animate-spin" /> : <BellRing />}
            {t("actions.sendReminder")}
          </Button>
          <Button size="sm" onClick={onRecover} disabled={isRecovering}>
            {isRecovering ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {t("actions.markRecovered")}
          </Button>
        </>
      )}
    </div>
  );
}
