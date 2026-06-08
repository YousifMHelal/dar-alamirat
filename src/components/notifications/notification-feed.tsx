"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart, Boxes, Settings, Star, Users, Bell, Loader2, Check, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { markNotificationRead } from "@/lib/notifications/actions";
import type { NotificationListRow, NotificationType } from "@/lib/notifications/queries";

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  ORDER: ShoppingCart,
  INVENTORY: Boxes,
  SYSTEM: Settings,
  REVIEW: Star,
  CUSTOMER: Users,
};

const TYPE_TONE: Record<NotificationType, string> = {
  ORDER: "bg-primary-soft text-primary",
  INVENTORY: "bg-warning/20 text-warning-foreground",
  SYSTEM: "bg-muted text-muted-foreground",
  REVIEW: "bg-accent/15 text-accent-foreground",
  CUSTOMER: "bg-success/12 text-success",
};

export type NotificationFeedRow = NotificationListRow & { formattedDate: string };

export function NotificationFeed({
  rows,
}: {
  rows: NotificationFeedRow[];
}) {
  const t = useTranslations("notifications");

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((n) => (
        <NotificationRow key={n.id} notification={n} t={t} />
      ))}
    </ul>
  );
}

function NotificationRow({
  notification,
  t,
}: {
  notification: NotificationFeedRow;
  t: ReturnType<typeof useTranslations<"notifications">>;
}) {
  const { toast } = useToast();
  const [isMarking, startMark] = useTransition();
  const Icon = TYPE_ICON[notification.type];
  const isUnread = !notification.readAt;

  const onMarkRead = () => {
    startMark(async () => {
      const res = await markNotificationRead(notification.id);
      if (!res.ok) toast(t(`errors.${res.error}` as never), "error");
    });
  };

  return (
    <li
      className={`bg-card shadow-soft border-border flex items-start gap-4 rounded-2xl border p-4 transition-colors ${
        isUnread ? "border-primary/30 bg-primary-soft/30" : ""
      }`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TYPE_TONE[notification.type]}`}>
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-foreground text-sm font-semibold">{notification.title}</h3>
          {isUnread && <span className="bg-primary inline-block size-2 rounded-full" aria-hidden />}
          <span className="text-muted-foreground ms-auto text-xs tabular-nums">{notification.formattedDate}</span>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{notification.body}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {notification.link && (
            <Link
              href={notification.link}
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition-colors"
            >
              {t("viewDetails")}
              <ExternalLink className="size-3 rtl:-scale-x-100" />
            </Link>
          )}
          {isUnread && (
            <Button variant="ghost" size="sm" onClick={onMarkRead} disabled={isMarking}>
              {isMarking ? <Loader2 className="animate-spin" /> : <Check />}
              {t("markRead")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
