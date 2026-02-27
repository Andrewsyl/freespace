#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.andrewsyl.carparking"
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"

echo "[prod] Building release APK..."
(
  cd android
  ./gradlew app:assembleRelease
)

if [ ! -f "$APK_PATH" ]; then
  echo "[prod] APK not found at $APK_PATH"
  exit 1
fi

if command -v adb >/dev/null 2>&1; then
  echo "[prod] Installing release APK on connected device..."
  adb uninstall "$APP_ID" >/dev/null 2>&1 || true
  adb install -r "$APK_PATH"
  adb shell am start -n "$APP_ID/.MainActivity"
  echo "[prod] Installed and launched $APP_ID"
else
  echo "[prod] adb not found. APK is ready at $APK_PATH"
fi
