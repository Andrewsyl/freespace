#!/usr/bin/env bash
set -euo pipefail

APP_ID="${1:-ie.freespace.app.dev}"
MAIN_ACTIVITY_CLASS="${2:-ie.freespace.app.MainActivity}"
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

echo "[debug] Building debug APK for $APP_ID..."
(
  cd android
  ./gradlew app:assembleDebug
)

if [ ! -f "$APK_PATH" ]; then
  echo "[debug] APK not found at $APK_PATH"
  exit 1
fi

if command -v adb >/dev/null 2>&1; then
  echo "[debug] Installing debug APK on connected device..."
  adb uninstall "$APP_ID" >/dev/null 2>&1 || true
  adb install -r "$APK_PATH"
  adb shell am start -n "$APP_ID/$MAIN_ACTIVITY_CLASS"
  echo "[debug] Installed and launched $APP_ID"
else
  echo "[debug] adb not found. APK is ready at $APK_PATH"
fi
