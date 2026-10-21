// Wrap de texte DÉTERMINISTE — jamais de mesure DOM (doc templates.md §0.5).
// Largeurs approximatives en em ; le wrap est une fonction pure du texte.

const WIDTHS: Record<string, number> = {
  // étroites
  i: 0.3, l: 0.28, t: 0.34, f: 0.33, j: 0.3, r: 0.38, "(": 0.35, ")": 0.35,
  "[": 0.35, "]": 0.35, ".": 0.3, ",": 0.3, ":": 0.3, ";": 0.3, "!": 0.32,
  "'": 0.22, "\u2019": 0.22, "|": 0.25,
  // larges
  m: 0.86, w: 0.82, M: 0.9, W: 0.95, "@": 0.9, "%": 0.82, "&": 0.78,
  // capitales & chiffres
  A: 0.7, B: 0.66, C: 0.7, D: 0.72, E: 0.62, F: 0.6, G: 0.74, H: 0.74,
  I: 0.3, J: 0.52, K: 0.68, L: 0.58, N: 0.74, O: 0.76, P: 0.62, Q: 0.76,
  R: 0.66, S: 0.64, T: 0.6, U: 0.72, V: 0.68, X: 0.66, Y: 0.64, Z: 0.62,
  "0": 0.62, "1": 0.42, "2": 0.62, "3": 0.6, "4": 0.64, "5": 0.6, "6": 0.62,
  "7": 0.56, "8": 0.62, "9": 0.62,
  "\u2014": 1.0, "\u2013": 0.6, "\u00AB": 0.5, "\u00BB": 0.5,
  "*": 0.4, "?": 0.52, "\u00E9": 0.55,
};

const DEFAULT_W = 0.56;
const SPACE_W = 0.3;

export function charWidth(ch: string): number {
  if (ch === " ") return SPACE_W;
  return WIDTHS[ch] ?? DEFAULT_W;
}

export function textWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w * fontSize;
}

/** Wrap glouton mot à mot sur maxWidth px. Retourne les lignes. */
export function wrapText(text: string, maxWidthPx: number, fontSize: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let lineW = 0;
  for (const word of words) {
    const wW = textWidth(word, fontSize);
    const spaceW = line ? SPACE_W * fontSize : 0;
    if (line && lineW + spaceW + wW > maxWidthPx) {
      lines.push(line);
      line = word;
      lineW = wW;
    } else {
      line = line ? `${line} ${word}` : word;
      lineW += spaceW + wW;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Auto-fit : réduit la taille par paliers de 2 px jusqu'à tenir sur maxLines. */
export function fitFont(
  text: string,
  maxWidthPx: number,
  base: number,
  min: number,
  maxLines: number,
): { fontSize: number; lines: string[] } {
  let size = base;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const lines = wrapText(text, maxWidthPx, size);
    if (lines.length <= maxLines || size <= min) return { fontSize: size, lines };
    size -= 2;
  }
}
