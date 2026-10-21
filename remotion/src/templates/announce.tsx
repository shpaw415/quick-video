import React from "react";
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from "remotion";
import type { VideoProps } from "../props";
import { easeInOut, easeOut, springPop, springSoft , interp } from "../motion";
import { FONT_DISPLAY, FONT_UI, tokens } from "../theme";
import { fitFont } from "../wrap";

// announce — annonce / lancement (360 frames = 12 s). Doc templates.md §3.
export const Announce: React.FC<VideoProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: d } = useVideoConfig();
  const t = tokens(p.theme, p.accent);
  const wide = p.format === "16:9";
  const titleW = wide ? 1560 : 780;
  const { fontSize, lines } = fitFont(p.title ?? p.text, titleW, wide ? 110 : 84, wide ? 84 : 64, 2);
  const sub = p.subtitle
    ? fitFont(p.subtitle, wide ? 1100 : 700, wide ? 40 : 34, wide ? 32 : 28, 2)
    : null;

  // formes flottantes : dérive sin(), déterministe (§0.7)
  const drift1 = { x: Math.sin(frame / 12) * 14, y: Math.sin(frame / 15) * 10 };
  const drift2 = { x: Math.sin(frame / 13 + 2) * 12, y: Math.sin(frame / 16 + 1) * 9 };
  const shapesOut = interp(frame, [d - 36, d - 12], [1, 0], { easing: easeInOut });

  const kickV = spring({ frame: frame - 12, fps, config: springPop });
  const contentOut = interp(frame, [d - 66, d - 42], [1, 0], { easing: easeInOut });
  const contentScale = interp(frame, [d - 66, d - 42], [1, 0.98], { easing: easeInOut });
  const ctaV = spring({ frame: frame - 210, fps, config: springPop });

  return (
    <AbsoluteFill style={{ background: t.bg }}>
      {/* halo radial statique — on n'anime que l'opacity (§0.8) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          width: 1200,
          height: 1200,
          marginLeft: -600,
          marginTop: -600,
          background: `radial-gradient(circle, ${t.accent} 0%, transparent 62%)`,
          opacity: 0.08 * interp(frame, [0, 12], [0, 1], { easing: easeOut }),
        }}
      />
      {/* deux formes flottantes */}
      <div
        style={{
          position: "absolute",
          left: wide ? "18%" : "12%",
          top: "22%",
          width: 380,
          height: 380,
          borderRadius: 999,
          background: t.accent,
          opacity: 0.12 * shapesOut,
          transform: `translate(${drift1.x}px, ${drift1.y}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: wide ? "72%" : "58%",
          top: "58%",
          width: 260,
          height: 260,
          borderRadius: 56,
          background: t.dim,
          opacity: 0.1 * shapesOut,
          transform: `translate(${drift2.x}px, ${drift2.y}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: wide ? "flex-start" : "center",
          justifyContent: "center",
          paddingLeft: wide ? 160 : 0,
          opacity: contentOut,
          transform: `scale(${contentScale})`,
        }}
      >
        <div style={{ width: wide ? 1560 : 780, display: "flex", flexDirection: "column", alignItems: wide ? "flex-start" : "center", gap: wide ? 28 : 24 }}>
          {p.kicker ? (
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 600,
                fontSize: 28,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: t.text,
                background: t.bgGlow,
                border: `1px solid ${t.dim}55`,
                borderRadius: 999,
                padding: "10px 28px",
                transform: `scale(${Math.max(0, kickV)})`,
                opacity: Math.min(1, kickV),
              }}
            >
              {p.kicker}
            </div>
          ) : null}
          {lines.map((line, i) => {
            const v = spring({ frame: frame - 30 + 8 * i, fps, config: springSoft, durationInFrames: 30 });
            return (
              <div
                key={i}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize,
                  lineHeight: 1.05,
                  color: t.text,
                  transform: `translateY(${(1 - v) * 44}px)`,
                  opacity: Math.min(1, v),
                }}
              >
                {line}
              </div>
            );
          })}
          <div
            style={{
              width: 180,
              height: 8,
              background: t.accent,
              transformOrigin: "left center",
              transform: `scaleX(${interp(frame, [66, 86], [0, 1], { easing: easeOut })})`,
            }}
          />
          {sub ? (
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 500,
                fontSize: sub.fontSize,
                lineHeight: 1.35,
                color: t.dim,
                textAlign: wide ? "left" : "center",
                transform: `translateY(${(1 - interp(frame, [84, 102], [0, 1], { easing: easeOut })) * 20}px)`,
                opacity: interp(frame, [84, 102], [0, 1], { easing: easeOut }),
              }}
            >
              {sub.lines.join(" ")}
            </div>
          ) : null}
          {p.cta ? (
            <div
              style={{
                marginTop: wide ? 26 : 20,
                fontFamily: FONT_UI,
                fontWeight: 600,
                fontSize: 34,
                color: t.onAccent,
                background: t.accent,
                borderRadius: 999,
                padding: wide ? "24px 56px" : "26px 48px",
                width: wide ? undefined : "100%",
                textAlign: "center",
                transform: `translateY(${(1 - ctaV) * 12}px) scale(${0.7 + 0.3 * Math.max(0, ctaV)})`,
                opacity: Math.min(1, Math.max(0, ctaV)),
              }}
            >
              {p.cta}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
