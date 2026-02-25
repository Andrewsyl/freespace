#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: run-with-env.sh <local|dev|qa|production> <command...>"
  exit 1
fi

ENV_NAME="$1"
shift
ENV_FILE=".env.${ENV_NAME}"

if [ "$ENV_NAME" = "local" ]; then
  ENV_FILE=".env.local.source"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

# Prevent Expo from auto-loading .env/.env.local so selected env stays authoritative.
export APP_ENV="$ENV_NAME"

set -a
. "$ENV_FILE"
set +a

# Expo loads .env.local by default and it can override shell exports in dev-client flows.
# Force selected env file into .env.local before starting (except local -> local).
cp "$ENV_FILE" .env.local

echo "[env] APP_ENV=$APP_ENV"
echo "[env] EXPO_PUBLIC_API_BASE=${EXPO_PUBLIC_API_BASE:-}"
echo "[env] synced .env.local from $ENV_FILE"

exec "$@"
