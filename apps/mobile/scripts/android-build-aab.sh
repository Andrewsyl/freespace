#!/usr/bin/env bash
set -euo pipefail

AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"

if [ -z "${ANDROID_UPLOAD_STORE_FILE:-}" ] || [ -z "${ANDROID_UPLOAD_STORE_PASSWORD:-}" ] || [ -z "${ANDROID_UPLOAD_KEY_ALIAS:-}" ] || [ -z "${ANDROID_UPLOAD_KEY_PASSWORD:-}" ]; then
  cat <<'EOF'
[prod] Missing Android upload signing credentials for a local Play AAB build.

Set these environment variables before running:
  ANDROID_UPLOAD_STORE_FILE
  ANDROID_UPLOAD_STORE_PASSWORD
  ANDROID_UPLOAD_KEY_ALIAS
  ANDROID_UPLOAD_KEY_PASSWORD

Example:
  ANDROID_UPLOAD_STORE_FILE=/absolute/path/to/upload-keystore.jks \
  ANDROID_UPLOAD_STORE_PASSWORD=... \
  ANDROID_UPLOAD_KEY_ALIAS=... \
  ANDROID_UPLOAD_KEY_PASSWORD=... \
  npm run android:prod:aab

This should use the same upload key you intend to keep for future Play uploads.
EOF
  exit 1
fi

echo "[prod] Building release AAB..."
(
  cd android
  ./gradlew app:bundleRelease
)

if [ ! -f "$AAB_PATH" ]; then
  echo "[prod] AAB not found at $AAB_PATH"
  exit 1
fi

echo "[prod] AAB ready at $AAB_PATH"
