import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { getModule, type ModuleKey } from "@/lib/modules";

/**
 * Shared placeholder for every module route: an editorial page header
 * (title + description) followed by a refined "coming in a later phase"
 * empty state. Copy is pulled from the message catalog by module key, so
 * every page is bilingual and the layout mirrors in RTL automatically.
 */
export function ModulePage({ moduleKey }: { moduleKey: ModuleKey }) {
  const t = useTranslations("modules");
  const mod = getModule(moduleKey);
  const Icon = mod?.icon ?? Sparkles;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-3 border-b pb-6">
        <div className="flex items-center gap-3">
          <span className="bg-primary-soft text-primary flex size-11 items-center justify-center rounded-xl">
            <Icon className="size-5" />
          </span>
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {t("comingSoon")}
          </span>
        </div>
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          {t(`${moduleKey}.title`)}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          {t(`${moduleKey}.description`)}
        </p>
      </header>

      <section className="bg-card shadow-soft border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center">
        <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl">
          <Sparkles className="size-6" />
        </span>
        <h2 className="font-display text-foreground text-xl font-semibold">
          {t("comingSoon")}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          {t("comingSoonBody")}
        </p>
      </section>
    </div>
  );
}
