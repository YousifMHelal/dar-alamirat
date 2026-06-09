"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sparkles, ArrowLeft, ArrowRight, RotateCcw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findShades, type ShadeFinderInput, type ShadeRecommendation } from "@/lib/ai/shade-finder";
import { formatSar } from "@/lib/format";

type Step = "undertone" | "depth" | "coverage" | "finish";
const STEPS: Step[] = ["undertone", "depth", "coverage", "finish"];

const UNDERTONE_OPTIONS = ["cool", "warm", "neutral"] as const;
const DEPTH_OPTIONS = ["fair", "light", "medium", "tan", "deep"] as const;
const COVERAGE_OPTIONS = ["light", "medium", "full"] as const;
const FINISH_OPTIONS = ["matte", "satin", "dewy"] as const;

interface QuizState {
  undertone?: ShadeFinderInput["undertone"];
  depth?: ShadeFinderInput["depth"];
  coverage?: ShadeFinderInput["coverage"];
  finish?: ShadeFinderInput["finish"];
}

export function ShadeFinderQuiz({ locale }: { locale: string }) {
  const t = useTranslations("shadeFinder");
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizState>({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ShadeRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentStep = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;

  const currentAnswer = answers[currentStep];

  function select(value: string) {
    setAnswers((prev) => ({ ...prev, [currentStep]: value as never }));
  }

  function back() {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function next() {
    if (!currentAnswer) return;
    setError(null);
    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }
    // Submit
    const input = answers as ShadeFinderInput;
    setLoading(true);
    try {
      const result = await findShades(input);
      if (result.ok) {
        setResults(result.recommendations);
      } else {
        setError(t(`errors.${result.error}`));
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setAnswers({});
    setStepIndex(0);
    setResults(null);
    setError(null);
  }

  function addToOrder(variantId: string, variantSku: string) {
    router.push(`/orders/new?variantId=${variantId}&sku=${encodeURIComponent(variantSku)}`);
  }

  if (results) {
    return (
      <ResultsPanel
        results={results}
        locale={locale}
        onReset={reset}
        onAddToOrder={addToOrder}
        t={t}
      />
    );
  }

  return (
    <div className="bg-card border-border shadow-soft mx-auto max-w-2xl rounded-2xl border p-8">
      {/* Progress */}
      <div className="mb-8 flex items-center gap-3">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all",
              i < stepIndex
                ? "bg-primary"
                : i === stepIndex
                  ? "bg-primary/50"
                  : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
        {t("step", { current: stepIndex + 1, total: STEPS.length })}
      </p>

      {/* Question */}
      {currentStep === "undertone" && (
        <QuizStep
          question={t("undertone.question")}
          options={UNDERTONE_OPTIONS.map((o) => ({
            value: o,
            label: t(`undertone.${o}`),
            hint: t(`undertone.${o}Hint`),
          }))}
          selected={answers.undertone}
          onSelect={select}
        />
      )}
      {currentStep === "depth" && (
        <QuizStep
          question={t("depth.question")}
          options={DEPTH_OPTIONS.map((o) => ({ value: o, label: t(`depth.${o}`) }))}
          selected={answers.depth}
          onSelect={select}
          columns={5}
        />
      )}
      {currentStep === "coverage" && (
        <QuizStep
          question={t("coverage.question")}
          options={COVERAGE_OPTIONS.map((o) => ({
            value: o,
            label: t(`coverage.${o}`),
            hint: t(`coverage.${o}Hint`),
          }))}
          selected={answers.coverage}
          onSelect={select}
        />
      )}
      {currentStep === "finish" && (
        <QuizStep
          question={t("finish.question")}
          options={FINISH_OPTIONS.map((o) => ({
            value: o,
            label: t(`finish.${o}`),
            hint: t(`finish.${o}Hint`),
          }))}
          selected={answers.finish}
          onSelect={select}
        />
      )}

      {error && <p className="text-destructive mt-4 text-sm">{error}</p>}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={back} disabled={stepIndex === 0 || loading}>
          <ArrowRight className="size-4" />
          {t("back")}
        </Button>
        <Button onClick={next} disabled={!currentAnswer || loading}>
          {loading ? (
            t("finding")
          ) : isLast ? (
            <>
              <Sparkles className="size-4" />
              {t("findMyShade")}
            </>
          ) : (
            <>
              {t("next")}
              <ArrowLeft className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function QuizStep({
  question,
  options,
  selected,
  onSelect,
  columns = 3,
}: {
  question: string;
  options: Array<{ value: string; label: string; hint?: string }>;
  selected: string | undefined;
  onSelect: (v: string) => void;
  columns?: number;
}) {
  return (
    <div>
      <h2 className="font-display text-foreground mb-6 text-xl font-semibold">{question}</h2>
      <div
        className={cn("grid gap-3", {
          "grid-cols-3": columns === 3,
          "grid-cols-5": columns === 5,
        })}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "rounded-xl border p-4 text-start transition-all focus-visible:outline-none focus-visible:ring-2",
              selected === opt.value
                ? "border-primary bg-primary/8 ring-primary/30 ring-1"
                : "border-border hover:border-primary/40 hover:bg-muted",
            )}
          >
            <span className="text-foreground block text-sm font-semibold">{opt.label}</span>
            {opt.hint && (
              <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                {opt.hint}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultsPanel({
  results,
  locale,
  onReset,
  onAddToOrder,
  t,
}: {
  results: ShadeRecommendation[];
  locale: string;
  onReset: () => void;
  onAddToOrder: (variantId: string, variantSku: string) => void;
  t: ReturnType<typeof useTranslations<"shadeFinder">>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-foreground text-xl font-semibold">
            {t("results.title")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("results.subtitle", { count: results.length })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="size-4" />
          {t("results.tryAgain")}
        </Button>
      </div>

      {results.length === 0 ? (
        <div className="bg-card border-border rounded-2xl border px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">{t("results.noResults")}</p>
          <Button variant="outline" className="mt-4" onClick={onReset}>
            {t("results.tryAgain")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {results.map((rec) => (
            <div
              key={rec.variantId}
              className="bg-card border-border shadow-soft flex flex-col overflow-hidden rounded-2xl border"
            >
              {/* Swatch / image */}
              <div className="relative flex h-36 items-center justify-center overflow-hidden bg-muted">
                {rec.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rec.imageUrl}
                    alt={rec.productNameEn}
                    className="h-full w-full object-cover"
                  />
                ) : rec.colorHex ? (
                  <div className="h-16 w-16 rounded-full border-4 border-white shadow" style={{ background: rec.colorHex }} />
                ) : (
                  <Sparkles className="text-muted-foreground size-10" />
                )}
                {rec.colorHex && (
                  <span
                    className="absolute end-3 top-3 h-5 w-5 rounded-full border-2 border-white shadow"
                    style={{ background: rec.colorHex }}
                  />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    {rec.brand}
                  </p>
                  <h3 className="text-foreground mt-0.5 font-semibold leading-tight">
                    {locale === "ar" ? rec.productNameAr : rec.productNameEn}
                  </h3>
                  {rec.colorName && (
                    <p className="text-muted-foreground mt-0.5 text-xs">{rec.colorName}</p>
                  )}
                  <p className="text-primary mt-1 text-sm font-semibold">
                    {formatSar(rec.price, locale)}
                  </p>
                </div>

                <div className="bg-muted rounded-lg p-3">
                  <p className="text-muted-foreground mb-1 text-xs font-semibold">
                    {t("results.reasoning")}
                  </p>
                  <p className="text-foreground text-xs leading-relaxed">{rec.reasoning}</p>
                </div>

                <Button
                  size="sm"
                  className="mt-auto w-full"
                  onClick={() => onAddToOrder(rec.variantId, rec.variantSku)}
                >
                  <ShoppingCart className="size-4" />
                  {t("results.addToOrder")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
