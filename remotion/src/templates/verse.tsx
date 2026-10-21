import React from "react";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";
import type { VideoProps } from "../props";
import { easeInOut, easeOut , interp } from "../motion";
import { FONT_SERIF, FONT_UI, tokens } from "../theme";
import { fitFont } from "../wrap";

// verse — verset du jour (300 frames = 10 s), cascade par mot. Doc templates.md §2.
export const Verse: React.FC<VideoProps> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const t = tokens(p.theme, p.accent);
  const wide = p.format === "16:9";
  const blockW = wide ? 1400 : 860;
  const { fontSize, lines } = fitFont(p.text, blockW, wide ? 72 : 56, wide ? 48 : 42, 10);

  const kicker = (p.kicker ?? "Verset du jour").trim();
  // Position plate de chaque mot (index de cascade stable, même texte → même rendu).
  const flat: string[] = [];
  lines.forEach((line) => line.split(/\s+/).filter(Boolean).forEach((w) => flat.push(w)));
  const n = flat.length;
  const raw = n > 1 ? Math.floor((194 - n) / (n - 1)) : 4;
  const stagger = Math.max(1, Math.min(4, raw));
  let counter = 0;
  const cascadeEnd = 36 + Math.max(0, n - 1) * stagger + 8;
  const refAt = cascadeEnd + 18;
  const exit = interp(frame, [d - 24, d], [1, 0], { easing: easeInOut });
  const zoom = interp(frame, [0, d], [1, 1.03], { easing: easeInOut });
  const rule = (from: number) => interp(frame, [from, from + 20], [0, 1], { easing: easeOut });

  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${t.bgGlow} 0%, ${t.bg} 72%)`,
          transform: `scale(${zoom})`,
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: exit }}>
        <div style={{ width: blockW, display: "flex", flexDirection: "column", alignItems: "center", gap: wide ? 26 : 22 }}>
          {/* filets décoratifs : latéral en 16:9, horizontaux en 9:16 */}
          {wide ? (
            <div style={{ position: "absolute", left: 120, top: "22%", bottom: "22%", width: 1, background: t.dim, opacity: 0.35 * rule(10) }} />
          ) : (
            <div style={{ width: 220, height: 1, background: t.dim, opacity: 0.5, transform: `scaleX(${rule(10)})` }} />
          )}
          {kicker ? (
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 600,
                fontSize: 26,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: t.dim,
                opacity: interp(frame, [20, 35], [0, 1], { easing: easeOut }),
              }}
            >
              {kicker}
            </div>
          ) : null}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            {lines.map((line, li) => (
              <div key={li} style={{ fontSize, fontFamily: FONT_SERIF, fontWeight: 500, lineHeight: 1.25, color: t.text, textAlign: "center" }}>
                {line
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((w, wi) => {
                    const idx = counter++;
                    const start = 36 + idx * stagger;
                    const v = interp(frame, [start, start + 8], [0, 1], { easing: easeOut });
                    return (
                      <span
                        key={wi}
                        style={{ display: "inline-block", opacity: v, transform: `translateY(${(1 - v) * 14}px)`, marginRight: 14 }}
                      >
                        {w}
                      </span>
                    );
                  })}
              </div>
            ))}
          </div>
          <div
            style={{
              fontFamily: FONT_UI,
              fontWeight: 600,
              fontSize: wide ? 40 : 34,
              color: t.accent,
              opacity: interp(frame, [refAt, refAt + 14], [0, 1], { easing: easeOut }),
              transform: `translateX(${(1 - interp(frame, [refAt, refAt + 14], [0, 1], { easing: easeOut })) * 20}px)`,
            }}
          >
            — {p.reference}
            {p.translation ? (
              <span
                style={{
                  fontFamily: FONT_UI,
                  fontWeight: 400,
                  fontSize: wide ? 26 : 22,
                  color: t.dim,
                  fontVariant: "small-caps",
                  marginLeft: 14,
                  opacity: interp(frame, [refAt + 10, refAt + 20], [0, 1], { easing: easeOut }),
                }}
              >
                {p.translation}
              </span>
            ) : null}
          </div>
          {!wide ? <div style={{ width: 220, height: 1, background: t.dim, opacity: 0.5, transform: `scaleX(${rule(16)})` }} /> : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
