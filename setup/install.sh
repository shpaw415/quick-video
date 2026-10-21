#!/bin/sh
# quick-video setup — idempotent, relancé à chaque réinstall/recréation du desktop.
# Assemble le moteur Remotion sous /opt/quick-video/remotion, installe ses
# dépendances npm et le navigateur headless. Aucun secret requis.
set -e

BIN="/usr/local/bin"
ENGINE="/opt/quick-video/remotion"
LOG_DIR="/home/agent/.open-bot/plugin-quick-video"

echo "[quick-video] setup start $(date -u +%FT%TZ)"

# 1. Node/npm (le desktop a Bun ; Remotion exige Node)
if ! command -v npm >/dev/null 2>&1; then
  echo "[quick-video] npm absent — installation via apt"
  apt-get update -qq
  apt-get install -y --no-install-recommends nodejs npm
fi
echo "[quick-video] node=$(node --version 2>/dev/null || echo MISSING) npm=$(npm --version 2>/dev/null || echo MISSING)"

# 2. Fontes de qualité (non fatal si absent — fallback Liberation déjà présent)
if command -v apt-get >/dev/null 2>&1; then
  dpkg -s fonts-inter >/dev/null 2>&1 || apt-get install -y --no-install-recommends fonts-inter 2>/dev/null || \
    echo "[quick-video] fonts-inter indisponible — fallback Liberation (rendu inchangé)"
fi

# 3. Assemblage du sous-projet Remotion (payloads à plats → arbre réel)
rm -rf "$ENGINE"
mkdir -p "$ENGINE/src/templates"
copy() { cp "$BIN/ob-plugin-quick-video-$1" "$ENGINE/$2"; }
copy engine-package.json package.json
copy engine-tsconfig.json tsconfig.json
copy engine-config.ts remotion.config.ts
copy engine-index.ts src/index.ts
copy engine-root.tsx src/Root.tsx
copy engine-props.ts src/props.ts
copy engine-theme.ts src/theme.ts
copy engine-motion.ts src/motion.ts
copy engine-wrap.ts src/wrap.ts
copy engine-tmpl-quote.tsx src/templates/quote.tsx
copy engine-tmpl-verse.tsx src/templates/verse.tsx
copy engine-tmpl-announce.tsx src/templates/announce.tsx
copy engine-tmpl-hook.tsx src/templates/hook.tsx
copy engine-tmpl-list.tsx src/templates/list.tsx
copy registry.json src/registry.json
echo "[quick-video] moteur assemblé dans $ENGINE"

# 4. npm + navigateur headless, sous l'identité de l'agent quand possible
SUDO=""
if [ "$(id -u)" = "0" ] && id -u agent >/dev/null 2>&1; then
  SUDO="sudo -u agent -H"
fi
chown -R agent:agent "$ENGINE" 2>/dev/null || true
mkdir -p "$LOG_DIR"
chown -R agent:agent "$(dirname "$LOG_DIR")" 2>/dev/null || true

$SUDO sh -c "cd '$ENGINE' && (npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund)"
echo "[quick-video] dépendances npm installées"
$SUDO sh -c "cd '$ENGINE' && npx remotion browser ensure"
echo "[quick-video] navigateur headless prêt"
chown -R agent:agent "$ENGINE" 2>/dev/null || true

# 5. Traçabilité
$SUDO sh -c "echo '$(date -u +%FT%TZ) node=$(node --version 2>/dev/null) remotion=$(cd '$ENGINE' && npx --no-install remotion versions 2>/dev/null | head -2 | tail -1)' >> '$LOG_DIR/install.log'" 2>/dev/null || true

# 6. Rendu de fumée (hook = 2,8 s, le plus court) — non fatal : doctor diagnostique
$SUDO sh -c "cd '$ENGINE' && printf '%s' '{\"format\":\"16:9\",\"theme\":\"dark\",\"text\":\"Smoke test\"}' > /tmp/qv-smoke-props.json && npx remotion render src/index.ts hook /tmp/qv-smoke.mp4 --props /tmp/qv-smoke-props.json --codec h264 --crf 18 --log error" \
  && echo "[quick-video] rendu de fumée OK" \
  || echo "[quick-video] AVERTISSEMENT : rendu de fumée échoué — charger quick-video-doctor"
rm -f /tmp/qv-smoke-props.json /tmp/qv-smoke.mp4

echo "[quick-video] setup done"
