#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo

# Load only DATABASE_URL (avoid sourcing PATH with spaces)
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    DATABASE_URL=*)
      export DATABASE_URL="${line#DATABASE_URL=}"
      # strip surrounding quotes
      DATABASE_URL="${DATABASE_URL%\"}"
      DATABASE_URL="${DATABASE_URL#\"}"
      DATABASE_URL="${DATABASE_URL%\'}"
      DATABASE_URL="${DATABASE_URL#\'}"
      export DATABASE_URL
      ;;
  esac
done < .env.local

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL missing"
  exit 1
fi

export PATH="/home/hitss/.nvm/versions/node/v20.20.2/bin:$PATH"
node scripts/delete-last-two.mjs
