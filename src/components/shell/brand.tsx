import { useTranslations } from "next-intl";
import Image from "next/image";
import logo from "@/logo.avif";

export function Brand({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("brand");

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center">
        <Image src={logo} alt="Dar Al-Amirat logo" width={36} height={36} className="rounded-xl object-contain" />
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
