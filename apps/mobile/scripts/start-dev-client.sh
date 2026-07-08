#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: start-dev-client.sh <local|dev|qa|production>"
  exit 1
fi

ENV_NAME="$1"
shift || true

APP_SCHEME="carparking"
if [ "$ENV_NAME" = "local" ] || [ "$ENV_NAME" = "dev" ]; then
  APP_SCHEME="carparking-dev"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXPO_DEV_HOST_MODE="${EXPO_DEV_HOST_MODE:-}"

detect_lan_ip() {
  local candidate=""

  if command -v ifconfig >/dev/null 2>&1; then
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

has_adb_device() {
  command -v adb >/dev/null 2>&1 && adb get-state >/dev/null 2>&1
}

resolve_host_mode() {
  if [ -n "$EXPO_DEV_HOST_MODE" ]; then
    printf '%s' "$EXPO_DEV_HOST_MODE"
    return
  fi

  if has_adb_device; then
    printf 'localhost'
    return
  fi

  printf 'lan'
}

HOST_MODE="$(resolve_host_mode)"
DEV_SERVER_HOST="127.0.0.1"
if [ "$HOST_MODE" = "lan" ]; then
  DEV_SERVER_HOST="$(detect_lan_ip)"
  if [ -z "$DEV_SERVER_HOST" ]; then
    echo "[dev-client][warn] Could not detect a LAN IP; falling back to localhost."
    HOST_MODE="localhost"
    DEV_SERVER_HOST="127.0.0.1"
  fi
fi

DEV_SERVER_PORT="${EXPO_DEV_PORT:-8081}"

launch_android_dev_client() {
  if ! has_adb_device; then
    echo "[dev-client] adb not found; Metro will start but Android won't auto-open."
    return
  fi

  (
    echo "[dev-client] Waiting for Metro, then opening Android dev client..."
    for _ in $(seq 1 60); do
      if curl -fsS --max-time 1 "http://127.0.0.1:${DEV_SERVER_PORT}" >/dev/null 2>&1; then
        adb start-server >/dev/null 2>&1 || true
        if [ "$HOST_MODE" = "localhost" ]; then
          adb reverse "tcp:${DEV_SERVER_PORT}" "tcp:${DEV_SERVER_PORT}" >/dev/null 2>&1 || true
          adb reverse tcp:4000 tcp:4000 >/dev/null 2>&1 || true
        fi
        if adb shell am start \
          -a android.intent.action.VIEW \
          -d "${APP_SCHEME}://expo-development-client/?url=http%3A%2F%2F${DEV_SERVER_HOST//./%2E}%3A${DEV_SERVER_PORT}" \
          >/dev/null 2>&1; then
          echo "[dev-client] Android dev client launch requested."
        else
          echo "[dev-client] Could not auto-open Android dev client. If the app is not installed, run: npm run android:local"
        fi
        break
      fi
      sleep 1
    done
  ) &

  # adb reverse only survives until the USB/adb transport blips (screen lock, cable
  # reseat, wifi-adb hiccup) — it is not re-applied automatically. Without this,
  # a physical device silently loses the tcp:4000 tunnel mid-session and every
  # request after that fails with "Network request failed" until Metro restarts.
  # Keep re-asserting it for the life of the Metro process so a drop self-heals.
  if [ "$HOST_MODE" = "localhost" ]; then
    (
      while true; do
        adb reverse "tcp:${DEV_SERVER_PORT}" "tcp:${DEV_SERVER_PORT}" >/dev/null 2>&1 || true
        adb reverse tcp:4000 tcp:4000 >/dev/null 2>&1 || true
        sleep 5
      done
    ) &
  fi
}

launch_android_dev_client

cd "$APP_DIR"
export EXPO_NO_INTERACTIVE=1
echo "[dev-client] Host mode: $HOST_MODE"
if [ "$HOST_MODE" = "lan" ]; then
  echo "[dev-client] LAN URL: http://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}"
fi
exec ./scripts/run-with-env.sh "$ENV_NAME" expo start "--${HOST_MODE}" -c --scheme "$APP_SCHEME" "$@"
