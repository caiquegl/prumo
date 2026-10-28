#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
CRON_SECRET=""
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    CRON_SECRET=*)
      v="${line#CRON_SECRET=}"
      v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
      CRON_SECRET="$v"
      ;;
  esac
done < .env.local
if [[ -z "$CRON_SECRET" ]]; then
  echo "CRON_SECRET missing"
  exit 1
fi

OUT=/tmp/prumo-fire-four.jsonl
: > "$OUT"

for i in 1 2 3 4; do
  echo "=== FIRE $i/4 ==="
  # small jitter so concept slugs differ
  sleep $((2 + i))
  resp=$(curl -sS --max-time 280 \
    "https://prumo-tawny.vercel.app/api/cron/instagram?secret=${CRON_SECRET}&force=1" || true)
  echo "$resp" | tee -a "$OUT"
  echo
  echo "$resp" | python3 -c '
import json,sys
try:
  d=json.load(sys.stdin)
except Exception as e:
  print("PARSE_FAIL", e); sys.exit(0)
print("SUMMARY", {
  "ok": d.get("ok"),
  "item": d.get("item"),
  "angle": d.get("angle"),
  "pillar": d.get("pillar"),
  "artist": d.get("artist"),
  "permalink": d.get("permalink"),
  "attempts": d.get("attempts"),
  "error": d.get("error"),
})
' || true
done

echo "=== ALL RAW ==="
cat "$OUT"
echo FIRE_FOUR_DONE
