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

launch_android_dev_client() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "[dev-client] adb not found; Metro will start but Android won't auto-open."
    return
  fi

  (
    echo "[dev-client] Waiting for Metro, then opening Android dev client..."
    for _ in $(seq 1 60); do
      if curl -fsS --max-time 1 "http://127.0.0.1:8081" >/dev/null 2>&1; then
        adb start-server >/dev/null 2>&1 || true
        adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
        adb reverse tcp:4000 tcp:4000 >/dev/null 2>&1 || true
        if adb shell am start \
          -a android.intent.action.VIEW \
          -d "${APP_SCHEME}://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" \
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
  (
    while true; do
      adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
      adb reverse tcp:4000 tcp:4000 >/dev/null 2>&1 || true
      sleep 5
    done
  ) &
}

launch_android_dev_client

cd "$APP_DIR"
export EXPO_NO_INTERACTIVE=1
exec ./scripts/run-with-env.sh "$ENV_NAME" expo start --localhost -c --scheme "$APP_SCHEME" "$@"
