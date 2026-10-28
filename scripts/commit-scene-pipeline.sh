#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Push new API keys to Vercel without printing secrets
need() {
  local key="$1"
  local val
  val=$(grep -E "^${key}=" .env.local | head -1 | cut -d= -f2-)
  if [[ -z "$val" ]]; then
    echo "skip $key (empty)"
    return 0
  fi
  npx vercel env rm "$key" production -y >/dev/null 2>&1 || true
  printf '%s' "$val" | npx vercel env add "$key" production >/dev/null
  echo "ok $key"
}

need ORSHOT_API_KEY
need JSON2VIDEO_API_KEY

git add \
  lib/ig/scene.ts \
  lib/ig/SceneCompose.tsx \
  lib/ig/compose.tsx \
  lib/ig/manager.ts \
  lib/ig/orshot.ts \
  lib/ig/json2video.ts \
  env.example \
  scripts/commit-scene-pipeline.sh \
  scripts/run-delete-last-two.sh \
  scripts/delete-last-two.mjs \
  scripts/probe-delete.mjs \
  scripts/run-probe-delete.sh 2>/dev/null || true

git status --short
git commit -m "$(cat <<'EOF'
feat(ig): scene graph Aviva+Felipe with Orshot/JSON2Video hooks

Replace band overlay with layered formats (productDark, editorialLight,
bastidor, anatomy). Wire Orshot as optional template fallback and
JSON2Video client for phase-2 reels.
EOF
)"

git push origin HEAD
echo PUSHED
