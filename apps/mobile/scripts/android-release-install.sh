#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.andrewsyl.carparking"
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"

if [ "${ALLOW_DEBUG_SIGNED_RELEASE:-0}" != "1" ]; then
  cat <<'EOF'
[prod] Refusing to build a local "production" APK with the debug signing key.

This repo's local Gradle release build is still debug-signed, which is fine for
basic manual checks but not valid for Google Sign-In or any true production-path
verification.

Use one of these instead:
  - npm run eas:prod        # real production-signed Android build
  - npm run android:qa      # local/non-production testing

If you intentionally want the old debug-signed release APK for a narrow local
check, rerun with:
  ALLOW_DEBUG_SIGNED_RELEASE=1 npm run android:prod:local-debug
EOF
  exit 1
fi

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
