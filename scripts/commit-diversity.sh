#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
export PATH="/home/hitss/.nvm/versions/node/v20.20.2/bin:$PATH"
git add lib/ig/manager.ts scripts/fire-four.sh scripts/commit-diversity.sh
git status --short
git commit -m "$(cat <<'EOF'
fix(ig): force format rotation and block similar concept stems

Lock each post to a rotated scene format and reject repeated
stems like dark-oled-conversion-machine so the grid stays varied.
EOF
)"
git push origin HEAD
echo PUSHED
