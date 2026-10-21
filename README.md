# Quick Video

Plugin open-bot : des **vidéos finies à partir de templates** — un texte, un template, un MP4 1080p (16:9 ou 9:16) déposé dans le workspace. Propulsé par [Remotion](https://www.remotion.dev/) (React → MP4), rendu 100 % local.

## Templates v0.1

| Template | Usage | Durée | Limite |
|---|---|---|---|
| `quote` | citation animée, témoignage | 8 s | 220 caractères |
| `verse` | verset du jour, série quotidienne | 10 s | 300 caractères |
| `announce` | lancement, annonce avec CTA | 12 s | titre 60 + sous-titre 110 |
| `hook` | accroche < 3 s, `*mot*` surligné | 2,8 s | 60 caractères |
| `list` | récap 3-5 points numérotés | 2,5 s + 2 s/point | items ≤ 64 caractères |

Deux formats (16:9 YouTube, 9:16 Shorts), deux palettes contrastées WCAG AA (Nuit / Jour), couleur d'accent personnalisable. Même texte → même vidéo : le rendu est déterministe.

## ⚠️ Licence Remotion — à lire avant usage en entreprise

Le moteur de rendu est [Remotion](https://www.remotion.dev/), sous **licence Remotion** : gratuite pour les **individus et les équipes de 3 personnes ou moins** ; les **entreprises plus grandes** doivent acquérir une licence Remotion payante. Ce plugin ne vérifie ni n'empêche la conformité — c'est à chaque installateur d'évaluer son propre cas (voir https://www.remotion.dev/license).

## Vie privée

- Aucun secret, aucune clé API, aucun compte requis.
- Tout tourne en local : les textes ne quittent jamais le desktop, le rendu n'accède à aucun service distant (les fontes sont système).
- Les vidéos atterrissent dans le dossier de sortie (par défaut `/home/agent/workspace/quick-video`) — rien n'est écrit ailleurs que dans les dossiers d'état du plugin (`~/.open-bot/plugin-quick-video`, `~/.open-bot/pages-data/quick-video`).
- Le désinstallation ne supprime jamais tes MP4.

## Usage

- **En chat** : demande « une citation animée avec tel texte », « un hook pour mon short », l'agent rend via les outils MCP `quick-video_render` / `quick-video_list_templates` et te livrer le MP4 dans la conversation.
- **Dashboard** : l'onglet **Quick Video** — choix du template avec aperçu, formulaire, zones sûres YouTube/Shorts, historique des rendus, thèmes clair et sombre.
- **Voix** : attache une piste audio existante (`audio_path` — wav/mp3/m4a/aac/ogg) et elle est muxée au rendu. Les compagnons voix (effectcraft-video, gen-video) sont optionnels : sans eux, la vidéo est muette avec un message clair, jamais une erreur.

## Configuration

`output_dir` (dossier de sortie), `render_timeout_s` (timeout de rendu), `default_format` (16:9 ou 9:16). Voir CONFIG.md.

## Diagnostic

Si les rendus échouent (après une recréation du desktop par exemple), charge le skill **quick-video-doctor** : il vérifie Node, le moteur, le navigateur headless et fait un rendu de fumée.

## Coût de rendu

Le rendu est CPU : une vidéo de 3-12 s prend typiquement **1 à 3 minutes**. Les rendus sont sérialisés (un à la fois) ; le dashboard affiche l'état.

## Développement

Sources : `~/plugins-create/quick-video` (moteur Remotion dans `remotion/`, jamais importé par Bun — frontière subprocess). Specs de conception du conseil : `docs/` (architecture, templates, design, formats YouTube).
