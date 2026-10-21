import React from "react";
import { Audio, Composition, staticFile } from "remotion";
import registry from "./registry.json";
import { listDurationFrames, type Format, type VideoProps } from "./props";
import { Quote } from "./templates/quote";
import { Verse } from "./templates/verse";
import { Announce } from "./templates/announce";
import { Hook } from "./templates/hook";
import { List } from "./templates/list";

const FPS = registry.fps;
const SIZES = registry.sizes as Record<Format, [number, number]>;

function dims(format: Format): { width: number; height: number } {
  const [width, height] = SIZES[format] ?? SIZES["16:9"];
  return { width, height };
}

const COMPONENTS: Record<string, React.FC<VideoProps>> = {
  quote: Quote,
  verse: Verse,
  announce: Announce,
  hook: Hook,
  list: List,
};

// L'audio est ajouté par enveloppe : zéro duplication dans les templates.
function makeComp(Comp: React.FC<VideoProps>): React.FC<VideoProps> {
  const C: React.FC<VideoProps> = (props) => (
    <>
      <Comp {...props} />
      {props.audioFile ? <Audio src={staticFile(props.audioFile)} /> : null}
    </>
  );
  return C;
}

const DEFAULTS: VideoProps = { format: "16:9", theme: "dark", text: "" };

export const RemotionRoot: React.FC = () => (
  <>
    {registry.templates.map((t) => {
      const Base = COMPONENTS[t.id];
      if (!Base) throw new Error(`no component for template ${t.id}`);
      return (
        <Composition
          key={t.id}
          id={t.id}
          component={makeComp(Base)}
          defaultProps={DEFAULTS}
          calculateMetadata={({ props }: { props: VideoProps }) => ({
            ...dims(props.format ?? "16:9"),
            fps: FPS,
            durationInFrames:
              t.id === "list"
                ? listDurationFrames((props.items ?? []).length || 3)
                : Math.round((t.duration_s as number) * FPS),
          })}
        />
      );
    })}
  </>
);
