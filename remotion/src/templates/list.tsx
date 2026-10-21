import React from "react";
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from "remotion";
import type { VideoProps } from "../props";
import { easeInOut, easeOut, springPop, springSoft , interp } from "../motion";
import { FONT_DISPLAY, FONT_UI, tokens } from "../theme";
import { fitFont } from "../wrap";

// list — récap / liste (75 + 60 × n items frames). Doc templates.md §5.
export const List: React.FC<VideoProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: d } = useVideoConfig();
  const t = tokens(p.theme, p.accent);
  const wide = p.format === "16:9";
  const blockW = wide ? 1560 : 880;
  const items = (p.items ?? []).slice(0, 5);
  const style = p.number_style ?? "chiffres";

  const title = fitFont(p.title ?? p.text, blockW, wide ? 72 : 56, wide ? 48 : 40, 2);
  const titleV = spring({ frame, fps, config: springSoft, durationInFrames: 24 });

  const exitFrom = d - 24;
  const outV = (i: number, from: number) =>
    interp(frame, [exitFrom + i * 4, exitFrom + i * 4 + 12], [0, 1], { easing: easeInOut });

  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, ${t.bgGlow} 0%, ${t.bg} 72%)` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: blockW, display: "flex", flexDirection: "column", gap: wide ? 34 : 30 }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: title.fontSize,
              lineHeight: 1.1,
              color: t.text,
              opacity: Math.min(1, titleV) * interp(frame, [exitFrom + 12, exitFrom + 24], [1, 0], { easing: easeInOut }),
              transform: `translateY(${(1 - titleV) * 36}px)`,
            }}
          >
            {title.lines.join(" ")}
          </div>
          <div
            style={{
              width: 120,
              height: 6,
              background: t.accent,
              transformOrigin: "left center",
              transform: `scaleX(${interp(frame, [12, 28], [0, 1], { easing: easeOut })})`,
            }}
          />
          {items.map((item, i) => {
            const from = 30 + 60 * i;
            const badge = spring({ frame: frame - from, fps, config: springPop });
            const txt = interp(frame, [from + 8, from + 22], [0, 1], { easing: easeOut });
            const tick = interp(frame, [from + 14, from + 38], [0, 1], { easing: easeOut });
            const out = outV(i, from);
            const badgeSize = wide ? 72 : 64;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  transform: `translateX(${-40 * out}px)`,
                  opacity: 1 - out,
                }}
              >
                <div
                  style={{
                    width: badgeSize,
                    height: badgeSize,
                    borderRadius: 999,
                    background: t.bgGlow,
                    border: `2px solid ${t.accent}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transform: `scale(${Math.max(0, badge)}) rotate(${(1 - Math.max(0, Math.min(1, badge))) * -10}deg)`,
                  }}
                >
                  {style === "chiffres" ? (
                    <span style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: wide ? 32 : 28, color: t.accent }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  ) : style === "points" ? (
                    <span style={{ width: 20, height: 20, borderRadius: 999, background: t.accent, display: "block" }} />
                  ) : (
                    <svg width={wide ? 36 : 32} height={wide ? 36 : 32} viewBox="0 0 24 24">
                      <path
                        d="M4 12.5 L10 18.5 L20 6.5"
                        fill="none"
                        stroke={t.accent}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={30}
                        strokeDashoffset={30 * (1 - Math.max(0, Math.min(1, badge)))}
                      />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: FONT_UI,
                      fontWeight: 500,
                      fontSize: wide ? 54 : 44,
                      lineHeight: 1.2,
                      color: t.text,
                      transform: `translateX(${(1 - txt) * 28}px)`,
                      opacity: txt,
                    }}
                  >
                    {item}
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 4,
                      background: t.accent,
                      opacity: 0.6,
                      marginTop: 10,
                      transformOrigin: "left center",
                      transform: `scaleX(${tick})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
