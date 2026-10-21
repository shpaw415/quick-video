// Props partagés de toutes les compositions (frontière Bun ↔ Remotion : JSON pur).
export type Format = "16:9" | "9:16";

export interface VideoProps {
  format: Format;
  theme: "dark" | "light";
  accent?: string;
  // Valeur du text_param du template (citation, verset, titre…)
  text: string;
  // quote
  author?: string;
  role?: string;
  // verse
  reference?: string;
  translation?: string;
  kicker?: string;
  // announce
  title?: string;
  subtitle?: string;
  cta?: string;
  // list
  items?: string[];
  number_style?: "chiffres" | "points" | "coches";
  // piste audio copiée dans public/ par le renderer (nom de fichier seul)
  audioFile?: string;
}

export function listDurationFrames(items: number): number {
  return 75 + 60 * Math.max(3, Math.min(5, items));
}
