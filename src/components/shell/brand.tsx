import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Brand lockup: a monogram tile plus the bilingual name + tagline.
 * `compact` hides the wordmark for the collapsed rail.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("brand");

  return (
    <div className="flex items-center gap-3">
      <div className="bg-primary text-primary-foreground shadow-accent flex size-9 shrink-0 items-center justify-center rounded-xl">
        <span className="font-display text-lg leading-none font-semibold">
          د
        </span>
      </div>
      {!compact && (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold tracking-tight">
            {t("name")}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {t("tagline")}
          </span>
        </div>
      )}
    </div>
  );
}
