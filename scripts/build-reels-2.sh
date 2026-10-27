#!/usr/bin/env bash
# Second batch: 5 reels (agenda ships silent) + 5 feed posts.
set -euo pipefail
export NVM_DIR="${HOME}/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
FFMPEG="$(cd "$HOME/prumo-media-tools" && node -e "process.stdout.write(require('ffmpeg-static'))")"
ASSETS=/mnt/c/Users/Hitss/prumo-assets
OUT=/home/hitss/prumo/public/ig
cd /home/hitss/prumo/media

reel() { # scene, output name, transpose ("" = silent)
  local scene=$1 name=$2 tr=$3
  if [ -n "$tr" ]; then
    node synth-music.js "/tmp/music-$scene.wav" 12 "$tr" >/dev/null
    "$FFMPEG" -y -loglevel error -framerate 30 -i "$ASSETS/frames/$scene/f%04d.jpg" -i "/tmp/music-$scene.wav" \
      -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 19 -preset slow -movflags +faststart \
      -c:a aac -b:a 160k -ar 44100 -shortest "$OUT/$name.mp4"
  else
    "$FFMPEG" -y -loglevel error -framerate 30 -i "$ASSETS/frames/$scene/f%04d.jpg" \
      -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 19 -preset slow -movflags +faststart -an "$OUT/$name.mp4"
  fi
  cp "$ASSETS/frames/$scene/f0359.jpg" "$OUT/$name-cover.jpg"
  echo "built $name"
}

reel prazo prumo-reel-03-prazo 0
reel trade prumo-reel-04-trade -3
reel lead prumo-reel-05-lead 2
reel antes prumo-reel-06-antes-depois 5
reel agenda prumo-reel-07-agenda ""

cp "$ASSETS/out2/post-performance.jpg" "$OUT/prumo-feed-17-performance.jpg"
cp "$ASSETS/out2/post-painel.jpg" "$OUT/prumo-feed-18-painel-trade.jpg"
cp "$ASSETS/out2/post-seguranca.jpg" "$OUT/prumo-feed-19-seguranca.jpg"
cp "$ASSETS/out2/post-integracoes.jpg" "$OUT/prumo-feed-20-integracoes.jpg"
cp "$ASSETS/out2/post-orcamento.jpg" "$OUT/prumo-feed-21-orcamento.jpg"
ls -la "$OUT" | grep -E "reel-0[3-7]|feed-(1[7-9]|2[01])"
echo BATCH2_OK
