#!/usr/bin/env bash
set -euo pipefail
export NVM_DIR="${HOME}/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
TOOLS="$HOME/prumo-media-tools"
mkdir -p "$TOOLS" && cd "$TOOLS"
[ -f package.json ] || npm init -y >/dev/null
npm install --silent ffmpeg-static msedge-tts
node -e "console.log(require('ffmpeg-static'))"
"$(node -e "process.stdout.write(require('ffmpeg-static'))")" -version | head -1
echo SETUP_OK
