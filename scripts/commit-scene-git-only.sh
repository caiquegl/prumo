#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
export PATH="/home/hitss/.nvm/versions/node/v20.20.2/bin:$PATH"

git add \
  lib/ig/scene.ts \
  lib/ig/SceneCompose.tsx \
  lib/ig/compose.tsx \
  lib/ig/manager.ts \
  lib/ig/orshot.ts \
  lib/ig/json2video.ts \
  env.example \
  scripts/commit-scene-pipeline.sh \
  scripts/commit-scene-git-only.sh \
  scripts/set-compose-keys.py \
  scripts/run-delete-last-two.sh \
  scripts/delete-last-two.mjs \
  scripts/probe-delete.mjs \
  scripts/run-probe-delete.sh

# never commit secrets
git reset HEAD .env.local 2>/dev/null || true
git checkout -- .env.local 2>/dev/null || true

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
