#!/usr/bin/env bash
# Usage: ./scripts/commit-push-landing.sh "commit message"
set -euo pipefail
export NVM_DIR="${HOME}/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
cd /home/hitss/prumo

MESSAGE="${1:-chore: update landing}"

echo "==> build"
yarn build

echo "==> git"
git add -A
git status -sb
if git diff --cached --quiet; then
  echo "Nothing to commit"
else
  git -c user.email="caiqueglcloud@gmail.com" -c user.name="Caique Garcia" \
    commit -m "$MESSAGE"
fi
git push origin main
git log -1 --oneline
echo "PUSH_OK"
