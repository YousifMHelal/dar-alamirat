"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Ban } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { disableGiftCard } from "@/lib/gift-cards/actions";

export function DisableCardButton({ giftCardId }: { giftCardId: string }) {
  const t = useTranslations("giftCards");
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const onDisable = () => {
    startTransition(async () => {
      const res = await disableGiftCard(giftCardId);
      if (res.ok) {
        toast(t("form.cardDisabled"), "success");
        router.refresh();
      } else {
        toast(t(`form.errors.${res.error}` as never), "error");
      }
    });
  };

  return (
    <Button variant="outline" onClick={onDisable} disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : <Ban />}
      {t("form.disable")}
    </Button>
  );
}
