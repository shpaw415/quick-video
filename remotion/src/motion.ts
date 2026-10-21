// Catalogue de mouvements — doc templates.md §0.6. Springs déterministes.
import { Easing, interpolate as rawInterpolate } from "remotion";

// Remotion `interpolate` EXTRAPOLUE par defaut : hors range, la valeur explose
// (scaleX 31, translateY -720px...). Tout le code des templates passe par ici,
// qui clampe des deux cotes.
export function interp(
  frame: number,
  input: readonly number[],
  output: readonly number[],
  opts?: { easing?: (n: number) => number },
): number {
  return rawInterpolate(frame, input, output, {
    ...opts,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export const springSoft = { damping: 16, mass: 0.9, stiffness: 120 } as const;
export const springPop = { damping: 12, mass: 0.7, stiffness: 240 } as const;
export const springSlam = {
  damping: 20,
  mass: 0.8,
  stiffness: 340,
  overshootClamping: true,
} as const;

export const easeOut = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.ease);
export const easeInQuad = Easing.in(Easing.quad);
