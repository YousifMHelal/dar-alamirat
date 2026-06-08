"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Page-specific heading, bilingual: { ar, en } */
  title?: { ar: string; en: string };
}

/**
 * Shared dashboard error UI. Used by every route's error.tsx.
 * Detects locale from <html dir> so it works without next-intl context
 * (error.tsx boundaries run outside the locale provider subtree).
 */
export function ErrorBoundary({ error, reset, title }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isRtl =
    typeof document !== "undefined" && document.documentElement.dir === "rtl";

  const heading = isRtl
    ? (title?.ar ?? "حدث خطأ غير متوقع")
    : (title?.en ?? "Something went wrong");

  const body = isRtl
    ? "تعذّر تحميل هذه الصفحة. يُرجى المحاولة مجدداً."
    : "We couldn't load this page. Please try again.";

  const retryLabel = isRtl ? "إعادة المحاولة" : "Try again";

  return (
    <div
      role="alert"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-6 px-4 py-16 text-center"
    >
      <span className="bg-destructive/10 text-destructive flex size-16 items-center justify-center rounded-full">
        <AlertTriangle className="size-8" />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-foreground text-xl font-semibold">{heading}</h2>
        <p className="text-muted-foreground max-w-sm text-sm">{body}</p>
        {error.digest && (
          <p className="text-muted-foreground/60 font-mono text-xs">
            {error.digest}
          </p>
        )}
      </div>

      <Button onClick={reset} variant="outline" size="sm">
        <RefreshCw className="size-4" />
        {retryLabel}
      </Button>
    </div>
  );
}
