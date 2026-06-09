"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles, ThumbsUp, Minus, ThumbsDown } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { analyzeReviewSentiment } from "@/lib/ai/analyze-review-sentiment";
import { saveReviewSentiment } from "@/lib/reviews/actions";
import type { ReviewSentimentValue } from "@/lib/ai/analyze-review-sentiment";

interface ReviewSentimentButtonProps {
  reviewId: string;
  body: string;
  title?: string | null;
  rating: number;
  sentiment: ReviewSentimentValue | null;
  themes: string[];
}

const SENTIMENT_TONE = {
  POSITIVE: "success",
  NEUTRAL: "neutral",
  NEGATIVE: "danger",
} as const;

const SENTIMENT_ICON = {
  POSITIVE: ThumbsUp,
  NEUTRAL: Minus,
  NEGATIVE: ThumbsDown,
} as const;

export function ReviewSentimentButton({
  reviewId,
  body,
  title,
  rating,
  sentiment: initialSentiment,
  themes: initialThemes,
}: ReviewSentimentButtonProps) {
  const t = useTranslations("reviews");
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [sentiment, setSentiment] = useState<ReviewSentimentValue | null>(initialSentiment);
  const [themes, setThemes] = useState<string[]>(initialThemes);

  const onAnalyze = () => {
    startTransition(async () => {
      const result = await analyzeReviewSentiment({ body, title, rating });
      if (!result.ok) {
        toast(t("sentiment.error"), "error");
        return;
      }
      const saveResult = await saveReviewSentiment(reviewId, result.sentiment, result.themes);
      if (!saveResult.ok) {
        toast(t("sentiment.error"), "error");
        return;
      }
      setSentiment(result.sentiment);
      setThemes(result.themes);
      toast(t("sentiment.success"), "success");
      router.refresh();
    });
  };

  if (sentiment) {
    const Icon = SENTIMENT_ICON[sentiment];
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={SENTIMENT_TONE[sentiment]}>
          <Icon />
          {t(`sentiment.${sentiment}`)}
        </Badge>
        {themes.map((theme) => (
          <Badge key={theme} tone="outline">
            {theme}
          </Badge>
        ))}
        <button
          onClick={onAnalyze}
          disabled={isPending}
          className="text-muted-foreground hover:text-foreground ml-0.5 inline-flex items-center gap-1 rounded p-0.5 text-xs transition-colors disabled:opacity-50"
          title={t("sentiment.reanalyze")}
        >
          {isPending ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
        </button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={onAnalyze} disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {isPending ? t("sentiment.analyzing") : t("sentiment.analyze")}
    </Button>
  );
}
