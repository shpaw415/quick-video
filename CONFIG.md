# Quick Video — configuration

Aucun secret : ce plugin ne demande **aucune clé API**. Tout le rendu est local.

## Réglages (onglet Plugins → Quick Video → Settings)

| Clé | Type | Défaut | Rôle |
|---|---|---|---|
| `output_dir` | string | `/home/agent/workspace/quick-video` | Dossier où atterrissent les MP4 (dans le workspace, jamais touché par la désinstallation). |
| `render_timeout_s` | number | `900` | Timeout d'un rendu en secondes (60-3600). Un rendu typique prend 1-3 min. |
| `default_format` | enum | `16:9` | Format par défaut (`16:9` YouTube ou `9:16` Shorts) quand l'appel ne le précise pas. |

## Voix et audio

- `options.audio_path` au rendu : chemin d'un fichier wav/mp3/m4a/aac/ogg existant, muxé à la vidéo pendant le rendu (moteur Remotion natif, sans ffmpeg).
- Les compagnons voix (effectcraft-video, gen-video) ne sont **pas requis** : sans piste audio, la vidéo est muette avec un avertissement `voice_skipped`, jamais une erreur.

## Dépannage

- « Moteur Remotion non installé » : relance l'installation du plugin (le setup réassemble `/opt/quick-video/remotion`, refait `npm install` et `npx remotion browser ensure`), ou charge le skill `quick-video-doctor`.
- Rendus lents : normal (CPU). Augmente `render_timeout_s` si tes vidéos sont longues.
- Les rendus sont sérialisés : un seul à la fois (verrou partagé MCP + dashboard).
