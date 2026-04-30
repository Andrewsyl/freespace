#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: run-with-env.sh <local|dev|qa|production> <command...>"
  exit 1
fi

ENV_NAME="$1"
shift
ENV_FILE=".env.${ENV_NAME}"
EXPLICIT_API_BASE="${EXPO_PUBLIC_API_BASE:-}"

if [ "$ENV_NAME" = "local" ]; then
  ENV_FILE=".env.local.source"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

# Prevent Expo from auto-loading .env/.env.local so selected env stays authoritative.
export APP_ENV="$ENV_NAME"
# Pass app environment into Gradle so Android build logic can branch per env.
export ORG_GRADLE_PROJECT_appEnv="$ENV_NAME"

set -a
. "$ENV_FILE"
set +a

if [ -n "$EXPLICIT_API_BASE" ]; then
  export EXPO_PUBLIC_API_BASE="$EXPLICIT_API_BASE"
fi

# Expo loads .env.local by default and it can override shell exports in dev-client flows.
# Force selected env file into .env.local before starting (except local -> local).
cp "$ENV_FILE" .env.local

if [ -n "$EXPLICIT_API_BASE" ]; then
  if grep -q '^EXPO_PUBLIC_API_BASE=' .env.local; then
    sed -i.bak "s#^EXPO_PUBLIC_API_BASE=.*#EXPO_PUBLIC_API_BASE=$EXPLICIT_API_BASE#" .env.local
  else
    printf '\nEXPO_PUBLIC_API_BASE=%s\n' "$EXPLICIT_API_BASE" >> .env.local
  fi
  rm -f .env.local.bak
fi

echo "[env] APP_ENV=$APP_ENV"
echo "[env] EXPO_PUBLIC_API_BASE=${EXPO_PUBLIC_API_BASE:-}"
echo "[env] synced .env.local from $ENV_FILE"

if [[ "$*" == *"expo run:android"* ]]; then
  if command -v adb >/dev/null 2>&1; then
    adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
    adb reverse tcp:4000 tcp:4000 >/dev/null 2>&1 || true
    echo "[env] adb reverse tcp:8081 -> tcp:8081"
    echo "[env] adb reverse tcp:4000 -> tcp:4000"
  fi
  if [ "$ENV_NAME" = "local" ] && command -v curl >/dev/null 2>&1; then
    if ! curl -fsS --max-time 2 "http://127.0.0.1:4000/health" >/dev/null 2>&1; then
      echo "[env][warn] Local API is not responding at http://127.0.0.1:4000/health"
      echo "[env][warn] Start it in another terminal: cd apps/api && npm run dev"
    fi
  fi
fi

exec "$@"
