/**
 * Fonts — Stage 0.7 / Design §4.1.
 * Inter → body/UI (--font-sans); Plus Jakarta Sans → display (--font-display).
 * Apply `${inter.variable} ${jakarta.variable}` on <html> in the root layout.
 */
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
