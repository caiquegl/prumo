#!/usr/bin/env bash
# Waits until the given files under /ig respond 200 on Vercel. Usage: wait-media.sh file1 file2 ...
set -uo pipefail
BASE=https://prumo-tawny.vercel.app/ig
for i in $(seq 1 40); do
  ok=1
  for f in "$@"; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$f")
    [ "$code" = "200" ] || { ok=0; break; }
  done
  [ $ok = 1 ] && { echo MEDIA_LIVE; exit 0; }
  sleep 10
done
echo MEDIA_TIMEOUT; exit 1
