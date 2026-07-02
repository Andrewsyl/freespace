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

detect_lan_ip() {
  local candidate=""

  if [ -z "$candidate" ] && command -v ifconfig >/dev/null 2>&1; then
    local interface=""
    for interface in $(ifconfig -l); do
      local interface_dump=""
      local ip=""
      interface_dump="$(ifconfig "$interface" 2>/dev/null || true)"
      if ! printf '%s\n' "$interface_dump" | grep -q "status: active"; then
        continue
      fi
      ip="$(
        printf '%s\n' "$interface_dump" | awk '
          /inet / {
            candidate_ip=$2
            if (candidate_ip !~ /^127\./ && candidate_ip !~ /^169\.254\./) {
              print candidate_ip
              exit
            }
          }
        '
      )"
      if [ -n "$ip" ]; then
        candidate="$ip"
        break
      fi
    done
  fi

  printf '%s' "$candidate"
}

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

if [ "$ENV_NAME" = "local" ] && [[ "$*" == *"expo start"* ]]; then
  case "${EXPO_PUBLIC_API_BASE:-}" in
    http://127.0.0.1:*|http://localhost:*)
      LAN_IP="$(detect_lan_ip)"
      if [ -n "$LAN_IP" ]; then
        export EXPO_PUBLIC_API_BASE="http://${LAN_IP}:4000"
        echo "[env] rewrote local API base for device access -> $EXPO_PUBLIC_API_BASE"
      else
        echo "[env][warn] Could not detect LAN IP; leaving EXPO_PUBLIC_API_BASE=${EXPO_PUBLIC_API_BASE:-}"
      fi
      ;;
  esac
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

if [ -n "${EXPO_PUBLIC_API_BASE:-}" ] && [ "${EXPO_PUBLIC_API_BASE:-}" != "${EXPLICIT_API_BASE:-}" ]; then
  if grep -q '^EXPO_PUBLIC_API_BASE=' .env.local; then
    sed -i.bak "s#^EXPO_PUBLIC_API_BASE=.*#EXPO_PUBLIC_API_BASE=${EXPO_PUBLIC_API_BASE}#" .env.local
  else
    printf '\nEXPO_PUBLIC_API_BASE=%s\n' "$EXPO_PUBLIC_API_BASE" >> .env.local
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

# The `local` flow already sources from .env.local.source, so .env.local is the
# local env — nothing to restore. Keep exec so the long-running dev server owns
# the process (unchanged behaviour).
if [ "$ENV_NAME" = "local" ]; then
  exec "$@"
fi

# For any remote env (dev/qa/production) we clobbered .env.local above. Restore it
# to the local env when the command finishes — otherwise the working tree is left
# pointing at a remote API/DB and the next `npm run dev:local` silently talks to it.
restore_local_env() {
  if [ -f .env.local.source ]; then
    cp .env.local.source .env.local
    echo "[env] restored .env.local -> local (from .env.local.source)"
  fi
}
trap restore_local_env EXIT INT TERM

set +e
"$@"
status=$?
set -e
exit "$status"
