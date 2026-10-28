#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
export PATH=/home/hitss/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin

set_env() {
  local key="$1"
  local val
  val=$(grep -E "^${key}=" .env.local | head -1 | cut -d= -f2-)
  [[ -n "$val" ]] || { echo "skip $key (ausente no .env.local)"; return 0; }
  vercel env rm "$key" production -y >/dev/null 2>&1 || true
  printf '%s' "$val" | vercel env add "$key" production >/dev/null
  echo "ok $key"
}

set_env POLLINATIONS_API_KEY
set_env HF_TOKEN
set_env GEMINI_IMAGE_MODEL
set_env IDEOGRAM_API_KEY
set_env RECRAFT_API_TOKEN
set_env RECRAFT_MODEL
echo ENV_DONE
