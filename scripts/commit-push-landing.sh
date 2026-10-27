#!/usr/bin/env bash
set -euo pipefail
export NVM_DIR="${HOME}/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
cd /home/hitss/prumo

echo "==> build"
yarn build

echo "==> git"
git add -A
git status -sb
if git diff --cached --quiet; then
  echo "Nothing to commit"
else
  git -c user.email="caiqueglcloud@gmail.com" -c user.name="Caique Garcia" \
    commit -m "feat: landing page + fix upload build + feed posts 09-13"
fi
git push origin main
git log -1 --oneline
echo "PUSH_OK"
