import React from "react";
import {AbsoluteFill, spring, useCurrentFrame} from "remotion";
import type { VideoProps } from "../props";
import { easeInQuad, springPop, springSlam , interp } from "../motion";
import { FONT_DISPLAY, tokens, type Tokens } from "../theme";
import { charWidth, SPACE_W } from "../wrap";

// hook — accroche < 3 s (84 frames = 2,8 s), *mot* surligné. Doc templates.md §4.

interface Word {
  w: string;
  hi: boolean;
}

function parseWords(text: string): Word[] {
  const out: Word[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last)
      for (const w of text.slice(last, m.index).split(/\s+/)) if (w) out.push({ w, hi: false });
    for (const w of m[1].split(/\s+/)) if (w) out.push({ w, hi: true });
    last = m.index + m[0].length;
  }
  if (last < text.length)
    for (const w of text.slice(last).split(/\s+/)) if (w) out.push({ w, hi: false });
  return out;
}

function lineWidth(words: Word[], fontSize: number): number {
  return words.reduce((acc, x) => acc + charWidth(x.w) * fontSize, 0) + Math.max(0, words.length - 1) * SPACE_W * fontSize;
}

function wrapFlagged(words: Word[], maxWidthPx: number, fontSize: number): Word[][] {
  const lines: Word[][] = [];
  let cur: Word[] = [];
  for (const word of words) {
    if (cur.length && lineWidth(cur, fontSize) + SPACE_W * fontSize + charWidth(word.w) * fontSize > maxWidthPx) {
      lines.push(cur);
      cur = [word];
    } else {
      cur.push(word);
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

export const Hook: React.FC<VideoProps> = (p) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const t: Tokens = tokens(p.theme, p.accent);
  const wide = p.format === "16:9";
  const blockW = wide ? 1560 : 920;
  const base = wide ? 112 : 120;
  const min = wide ? 80 : 84;

  const words = parseWords(p.text);
  let fontSize = base;
  let lines = wrapFlagged(words, blockW, fontSize);
  while (lines.length > 3 && fontSize > min) {
    fontSize -= 2;
    lines = wrapFlagged(words, blockW, fontSize);
  }

  // slam : tout le texte arrive d'un coup — un hook n'attend pas (§4)
  const slam = spring({ frame, fps, config: springSlam, durationInFrames: 12 });
  const opacity0 = interp(frame, [0, 3], [0, 1]);
  const pushIn = interp(frame, [20, 68], [1, 1.035]);
  const exit = interp(frame, [68, 74], [1, 0], { easing: easeInQuad });

  return (
    <AbsoluteFill style={{ background: t.bg, opacity: exit }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, ${t.bgGlow} 0%, ${t.bg} 72%)` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: blockW,
            transform: `translateY(${(1 - slam) * -10}px) scale(${(0.85 + 0.15 * slam) * pushIn})`,
            opacity: opacity0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          {lines.map((line, li) => (
            <div
              key={li}
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize,
                lineHeight: 1.08,
                color: t.text,
                textAlign: "center",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                columnGap: 18,
                rowGap: 6,
              }}
            >
              {line.map((word, wi) => {
                if (!word.hi) {
                  return (
                    <span key={wi} style={{ position: "relative", zIndex: 1 }}>
                      {word.w}
                    </span>
                  );
                }
                const pill = spring({ frame: frame - 14, fps, config: springPop });
                const hiColor = frame >= 25 ? t.onAccent : t.text;
                return (
                  <span key={wi} style={{ position: "relative", display: "inline-block", zIndex: 1, color: hiColor }}>
                    <span
                      style={{
                        position: "absolute",
                        left: -18,
                        right: -18,
                        top: -6,
                        bottom: -4,
                        background: t.accent,
                        borderRadius: 16,
                        transformOrigin: "left center",
                        transform: `scaleX(${Math.max(0, Math.min(1, pill))}) rotate(-1.2deg)`,
                        zIndex: 0,
                      }}
                    />
                    <span style={{ position: "relative", zIndex: 1 }}>{word.w}</span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
