#!/usr/bin/env bash
# Usage: ./scripts/upload-image.sh ./path/to/image.jpg [folder]
set -euo pipefail

FILE="${1:-}"
FOLDER="${2:-ig}"
BASE_URL="${PRUMO_UPLOAD_URL:-}"
TOKEN="${UPLOAD_SECRET:-}"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Uso: PRUMO_UPLOAD_URL=https://<seu-deploy>.vercel.app $0 <arquivo.jpg> [folder]" >&2
  exit 1
fi

if [[ -z "$BASE_URL" ]]; then
  echo "Defina PRUMO_UPLOAD_URL (ex: https://prumo-xxx.vercel.app). Não use prumo.vercel.app (outro projeto)." >&2
  exit 1
fi

ARGS=(-sS -X POST -F "file=@${FILE}" -F "folder=${FOLDER}")
if [[ -n "$TOKEN" ]]; then
  ARGS+=(-H "Authorization: Bearer ${TOKEN}")
fi

curl "${ARGS[@]}" "${BASE_URL}/api/upload"
echo
