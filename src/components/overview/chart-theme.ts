"use client";

/**
 * Recharts renders raw SVG, so it can't consume Tailwind utility classes
 * for fills/strokes — it needs concrete colour values. We read the design
 * tokens off the document root once on the client so the charts stay in
 * lockstep with the CSS variable palette (light/dark, brand tweaks) rather
 * than hardcoding hex.
 */

const CHART_VARS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
] as const;

const SEMANTIC_VARS = {
  grid: "--border",
  axis: "--muted-foreground",
  primary: "--primary",
  accent: "--accent",
  surface: "--card",
  foreground: "--foreground",
} as const;

function readVar(name: string): string {
  if (typeof window === "undefined") return "#000";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface ChartTheme {
  series: string[];
  grid: string;
  axis: string;
  primary: string;
  accent: string;
  surface: string;
  foreground: string;
}

/** Resolve the chart palette + semantic colours from CSS variables. */
export function readChartTheme(): ChartTheme {
  return {
    series: CHART_VARS.map(readVar),
    grid: readVar(SEMANTIC_VARS.grid),
    axis: readVar(SEMANTIC_VARS.axis),
    primary: readVar(SEMANTIC_VARS.primary),
    accent: readVar(SEMANTIC_VARS.accent),
    surface: readVar(SEMANTIC_VARS.surface),
    foreground: readVar(SEMANTIC_VARS.foreground),
  };
}
