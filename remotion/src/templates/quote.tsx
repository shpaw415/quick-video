import React from "react";
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from "remotion";
import type { VideoProps } from "../props";
import { easeInOut, easeOut, springPop, springSoft , interp } from "../motion";
import { FONT_UI, tokens } from "../theme";
import { fitFont } from "../wrap";

// quote — carte citation (240 frames = 8 s). Doc templates.md §1.
export const Quote: React.FC<VideoProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: d } = useVideoConfig();
  const t = tokens(p.theme, p.accent);
  const wide = p.format === "16:9";
  const blockW = wide ? 1360 : 780;
  const baseF = wide ? 76 : 64;
  const minF = wide ? 54 : 46;
  const { fontSize, lines } = fitFont(p.text, blockW, baseF, minF, 5);
  const quoteSize = wide ? 180 : 150;

  // zoom ambiant 1→1.02 sur toute la durée
  const zoom = interp(frame, [0, d], [1, 1.02], { easing: easeInOut });
  // sortie globale 216→240
  const exit = interp(frame, [d - 24, d], [1, 0], { easing: easeInOut });
  const exitScale = interp(frame, [d - 24, d], [1, 1.03], { easing: easeInOut });

  const lineStart = (i: number) => 24 + 10 * i;
  const lastLine = lineStart(lines.length - 1);
  const ruleAt = lastLine + 12;
  const authorAt = ruleAt + 10;
  const roleAt = authorAt + 8;

  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${t.bgGlow} 0%, ${t.bg} 72%)`,
          transform: `scale(${zoom})`,
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: exit,
          transform: `scale(${exitScale})`,
        }}
      >
        <div
          style={{
            width: blockW,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: wide ? 18 : 14,
          }}
        >
          <div
            style={{
              fontFamily: FONT_UI,
              fontWeight: 800,
              fontSize: quoteSize,
              lineHeight: 0.9,
              color: t.accent,
              marginBottom: wide ? 8 : 4,
              transform: `translateY(${(1 - spring({ frame: frame - 8, fps, config: springPop })) * 20}px)`,
              opacity: Math.min(1, spring({ frame: frame - 8, fps, config: springPop })),
            }}
          >
            «
          </div>
          {lines.map((line, i) => {
            const v = spring({ frame: frame - lineStart(i), fps, config: springSoft, durationInFrames: 30 });
            return (
              <div
                key={i}
                style={{
                  fontFamily: FONT_UI,
                  fontWeight: 600,
                  fontSize,
                  lineHeight: 1.25,
                  color: t.text,
                  transform: `translateY(${(1 - v) * 36}px)`,
                  opacity: Math.min(1, v),
                }}
              >
                {line}
              </div>
            );
          })}
          <div
            style={{
              width: 48,
              height: 6,
              background: t.accent,
              marginTop: 10,
              transformOrigin: "left center",
              transform: `scaleX(${interp(frame, [ruleAt, ruleAt + 18], [0, 1], { easing: easeOut })})`,
            }}
          />
          {p.author ? (
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 600,
                fontSize: wide ? 40 : 34,
                color: t.text,
                marginTop: 12,
                transform: `translateY(${(1 - interp(frame, [authorAt, authorAt + 14], [0, 1], { easing: easeOut })) * 24}px)`,
                opacity: interp(frame, [authorAt, authorAt + 14], [0, 1], { easing: easeOut }),
              }}
            >
              {p.author}
            </div>
          ) : null}
          {p.author && p.role ? (
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 400,
                fontSize: wide ? 30 : 26,
                color: t.dim,
                transform: `translateY(${(1 - interp(frame, [roleAt, roleAt + 14], [0, 1], { easing: easeOut })) * 24}px)`,
                opacity: interp(frame, [roleAt, roleAt + 14], [0, 1], { easing: easeOut }),
              }}
            >
              {p.role}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
