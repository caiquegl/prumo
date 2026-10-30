#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/hitss/.nvm/versions/node/v20.20.2/bin:/home/hitss/.local/bin:$PATH"
cd /home/hitss/prumo
bash scripts/ensure-ffmpeg.sh
node scripts/render-reel-laptop.mjs
ls -la public/ig/prumo-reel-laptop.mp4 public/ig/prumo-reel-laptop-cover.jpg
