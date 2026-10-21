// Design tokens — doc design.md §1.1/§1.2 (contraste auditée WCAG AA).
// Un seul accent par vidéo ; onAccent calculé par luminance si accent personnalisé.
export type ThemeName = "dark" | "light";

export interface Tokens {
  bg: string;
  bgGlow: string; // vignette radiale (même teinte, ±4 % de luminosité)
  text: string;
  dim: string;
  accent: string;
  onAccent: string;
}

export const PALETTES: Record<ThemeName, Tokens> = {
  dark: {
    bg: "#0B0E14",
    bgGlow: "#141926",
    text: "#F5F7FA",
    dim: "#A8B3C5",
    accent: "#FFB224",
    onAccent: "#1A1206",
  },
  light: {
    bg: "#FAF7F2",
    bgGlow: "#FFFFFF",
    text: "#16181D",
    dim: "#5A6472",
    accent: "#B45309",
    onAccent: "#FFFFFF",
  },
};

// Luminance relative WCAG 2.1 — texte posé SUR l'accent.
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const chan = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

export function tokens(theme: ThemeName, accent?: string): Tokens {
  const base = PALETTES[theme];
  if (!accent) return base;
  return { ...base, accent, onAccent: luminance(accent) > 0.35 ? "#1A1206" : "#FFFFFF" };
}

export const FONT_DISPLAY = '"Archivo Black", "Liberation Sans", "Arial Black", sans-serif';
export const FONT_SERIF = '"Lora", "Liberation Serif", Georgia, serif';
export const FONT_UI = '"Inter", "Liberation Sans", system-ui, sans-serif';
