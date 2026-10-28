#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    DATABASE_URL=*)
      v="${line#DATABASE_URL=}"
      v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
      export DATABASE_URL="$v"
      ;;
  esac
done < .env.local
export PATH="/home/hitss/.nvm/versions/node/v20.20.2/bin:$PATH"
node scripts/probe-delete.mjs
