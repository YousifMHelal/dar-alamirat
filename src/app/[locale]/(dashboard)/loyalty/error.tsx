"use client";
import { ErrorBoundary } from "@/components/shell/error-boundary";
export default function Error(props: Parameters<typeof ErrorBoundary>[0]) {
  return (
    <ErrorBoundary
      {...props}
      title={{ ar: "خطأ في نقاط العملاء", en: "Loyalty error" }}
    />
  );
}
