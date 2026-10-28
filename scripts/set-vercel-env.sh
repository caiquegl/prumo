#!/usr/bin/env bash
# Push artist keys from .env.local to Vercel (production). Does not print secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=.env.local

need() {
  local key="$1"
  local val
  val=$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2-)
  if [[ -z "$val" ]]; then
    echo "skip $key (empty)"
    return 0
  fi
  # remove existing then add
  npx vercel env rm "$key" production -y >/dev/null 2>&1 || true
  printf '%s' "$val" | npx vercel env add "$key" production >/dev/null
  echo "ok $key"
}

need POLLINATIONS_API_KEY
need HF_TOKEN
need LEONARDO_API_KEY
need LEONARDO_MODEL_ID
need GEMINI_IMAGE_MODEL
echo done
