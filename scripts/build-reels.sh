#!/usr/bin/env bash
# Assembles reel MP4s from rendered frames. TERRA gets the synthesized track; PRISMA ships silent.
set -euo pipefail
export NVM_DIR="${HOME}/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
FFMPEG="$(cd "$HOME/prumo-media-tools" && node -e "process.stdout.write(require('ffmpeg-static'))")"
FRAMES=/mnt/c/Users/Hitss/prumo-assets/frames
OUT=/home/hitss/prumo/public/ig
cd /home/hitss/prumo/media

node synth-music.js /tmp/prumo-music.wav 9.5

"$FFMPEG" -y -loglevel error -framerate 30 -i "$FRAMES/terra/f%04d.jpg" -i /tmp/prumo-music.wav \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 19 -preset slow -movflags +faststart \
  -c:a aac -b:a 160k -ar 44100 -shortest "$OUT/prumo-reel-01-terra.mp4"

"$FFMPEG" -y -loglevel error -framerate 30 -i "$FRAMES/prisma/f%04d.jpg" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 19 -preset slow -movflags +faststart \
  -an "$OUT/prumo-reel-02-prisma.mp4"

cp /mnt/c/Users/Hitss/prumo-assets/out/post-lex.jpg "$OUT/prumo-feed-14-lex.jpg"
cp /mnt/c/Users/Hitss/prumo-assets/out/post-pata.jpg "$OUT/prumo-feed-15-pata.jpg"
cp /mnt/c/Users/Hitss/prumo-assets/out/post-motriz.jpg "$OUT/prumo-feed-16-motriz.jpg"
cp /mnt/c/Users/Hitss/prumo-assets/out/story-projetos.jpg "$OUT/prumo-story-01-projetos.jpg"
cp "$FRAMES/terra/f0284.jpg" "$OUT/prumo-reel-01-terra-cover.jpg"
cp "$FRAMES/prisma/f0284.jpg" "$OUT/prumo-reel-02-prisma-cover.jpg"
cp "$OUT/prumo-reel-01-terra.mp4" /mnt/c/Users/Hitss/prumo-assets/out/
cp "$OUT/prumo-reel-02-prisma.mp4" /mnt/c/Users/Hitss/prumo-assets/out/
ls -la "$OUT" | grep -E "reel|1[4-6]|story"
echo REELS_OK
