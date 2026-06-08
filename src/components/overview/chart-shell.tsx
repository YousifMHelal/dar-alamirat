"use client";

import { useSyncExternalStore } from "react";
import { readChartTheme, type ChartTheme } from "./chart-theme";

/** Subscribe to prefers-reduced-motion via useSyncExternalStore (no effect). */
function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function reducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Client theme snapshot for useSyncExternalStore. The resolved theme is
 * cached so the snapshot returns a STABLE reference (a fresh object every
 * call would loop the store). The store never notifies (the palette is
 * static after load), so an empty subscribe is correct; this gives us a
 * null server snapshot and the real theme on the client without an effect
 * and without a hydration mismatch (the store reconciles server→client).
 */
let cachedTheme: ChartTheme | null = null;
function subscribeNoop(): () => void {
  return () => {};
}
function clientThemeSnapshot(): ChartTheme {
  if (!cachedTheme) cachedTheme = readChartTheme();
  return cachedTheme;
}
function serverThemeSnapshot(): null {
  return null;
}

/**
 * Shared chrome for every analytics chart: a titled card with a soft
 * shadow (matching the orders/inventory tables), an optional subtitle, and
 * a fixed-height plot area so the page has no layout shift while Recharts
 * mounts. Children receive the resolved chart theme.
 *
 * `prefers-reduced-motion` is honoured by disabling Recharts' entrance
 * animation (passed through `animate`) so data is readable immediately.
 */
export function ChartCard({
  title,
  subtitle,
  height = 280,
  children,
}: {
  title: string;
  subtitle?: string;
  height?: number;
  children: (ctx: { theme: ChartTheme; animate: boolean }) => React.ReactNode;
}) {
  // Theme is resolved on the client (it reads CSS variables off the DOM);
  // on the server it's null so the shell renders with an empty, fixed-height
  // plot — no SSR/CSR mismatch and no layout shift. Lazy-init avoids a
  // setState-in-effect cascade.
  const theme = useSyncExternalStore(
    subscribeNoop,
    clientThemeSnapshot,
    serverThemeSnapshot,
  );
  // Reduced-motion is read through an external store so the entrance
  // animation is disabled immediately and stays in sync with OS changes.
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    () => false, // server snapshot
  );
  const animate = !reduced;

  return (
    <section className="bg-card shadow-soft border-border flex flex-col rounded-2xl border p-5">
      <header className="mb-4 flex flex-col gap-0.5">
        <h3 className="font-display text-foreground text-base font-semibold">{title}</h3>
        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
      </header>
      <div style={{ height }} className="min-w-0">
        {theme && children({ theme, animate })}
      </div>
    </section>
  );
}

/** Centered empty state used inside a chart plot area when a range is empty. */
export function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      {label}
    </div>
  );
}
