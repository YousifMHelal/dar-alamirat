import {
  IBM_Plex_Sans_Arabic,
  Inter,
  Playfair_Display,
} from "next/font/google";

/**
 * Per-locale type system.
 *
 * - `inter`     → Latin body/UI text (en).
 * - `plexArabic`→ Arabic body/UI text (ar) — clean, highly legible.
 * - `playfair`  → editorial display serif for Latin headings only.
 *
 * All three expose CSS variables consumed by the Tailwind theme in
 * globals.css. The locale layout decides which variable feeds
 * `--font-latin` vs `--font-arabic` so the correct face leads the
 * font stack for the active locale.
 */

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-arabic",
});

export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});
