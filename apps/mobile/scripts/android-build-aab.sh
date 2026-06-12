#!/usr/bin/env bash
set -euo pipefail

AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_CREDENTIALS_JSON="$MOBILE_DIR/credentials.json"
APP_JSON="$MOBILE_DIR/app.json"

# ── Keystore credentials ─────────────────────────────────────────────────────

load_keystore_credentials() {
  if [ -z "${ANDROID_UPLOAD_STORE_FILE:-}" ] || [ -z "${ANDROID_UPLOAD_STORE_PASSWORD:-}" ] || [ -z "${ANDROID_UPLOAD_KEY_ALIAS:-}" ] || [ -z "${ANDROID_UPLOAD_KEY_PASSWORD:-}" ]; then
    if [ -f "$DEFAULT_CREDENTIALS_JSON" ]; then
      local creds
      creds="$(node -e "const fs=require('fs'); const p=process.argv[1]; const data=JSON.parse(fs.readFileSync(p,'utf8')); const k=data && data.android && data.android.keystore; if (!k) process.exit(2); process.stdout.write([k.keystorePath,k.keystorePassword,k.keyAlias,k.keyPassword].join('\n'));" "$DEFAULT_CREDENTIALS_JSON")" || return 1
      ANDROID_UPLOAD_STORE_FILE="${ANDROID_UPLOAD_STORE_FILE:-$(printf '%s' "$creds" | sed -n '1p')}"
      ANDROID_UPLOAD_STORE_PASSWORD="${ANDROID_UPLOAD_STORE_PASSWORD:-$(printf '%s' "$creds" | sed -n '2p')}"
      ANDROID_UPLOAD_KEY_ALIAS="${ANDROID_UPLOAD_KEY_ALIAS:-$(printf '%s' "$creds" | sed -n '3p')}"
      ANDROID_UPLOAD_KEY_PASSWORD="${ANDROID_UPLOAD_KEY_PASSWORD:-$(printf '%s' "$creds" | sed -n '4p')}"
      export ANDROID_UPLOAD_STORE_FILE ANDROID_UPLOAD_STORE_PASSWORD ANDROID_UPLOAD_KEY_ALIAS ANDROID_UPLOAD_KEY_PASSWORD
    fi
  fi
}

load_keystore_credentials || true

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

case "$ANDROID_UPLOAD_STORE_FILE" in
  /*) ;;
  *) ANDROID_UPLOAD_STORE_FILE="$MOBILE_DIR/$ANDROID_UPLOAD_STORE_FILE" ;;
esac

if [ ! -f "$ANDROID_UPLOAD_STORE_FILE" ]; then
  echo "[prod] Android upload keystore not found: $ANDROID_UPLOAD_STORE_FILE"
  exit 1
fi

# ── Version code ─────────────────────────────────────────────────────────────
# Read current versionCode from app.json, increment by 1, write back.
# app.json is the single source of truth; build.gradle reads it via -PappVersionCode.

read_version_info() {
  node -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    process.stdout.write(JSON.stringify({
      code: d.expo.android.versionCode,
      name: d.expo.version,
    }));
  " "$APP_JSON"
}

bump_version_code() {
  local new_code="$1"
  node -e "
    const fs = require('fs');
    const path = process.argv[1];
    const d = JSON.parse(fs.readFileSync(path, 'utf8'));
    d.expo.android.versionCode = parseInt(process.argv[2], 10);
    fs.writeFileSync(path, JSON.stringify(d, null, 2) + '\n', 'utf8');
  " "$APP_JSON" "$new_code"
}

VERSION_INFO="$(read_version_info)"
CURRENT_CODE="$(node -e "process.stdout.write(String(JSON.parse(process.argv[1]).code))" "$VERSION_INFO")"
VERSION_NAME="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).name)" "$VERSION_INFO")"
NEW_CODE=$(( CURRENT_CODE + 1 ))

bump_version_code "$NEW_CODE"
echo "[prod] versionCode bumped: $CURRENT_CODE → $NEW_CODE"

# ── Pre-flight summary ────────────────────────────────────────────────────────

STRIPE_KEY="${EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}"
API_BASE="${EXPO_PUBLIC_API_BASE:-}"

if [[ "$STRIPE_KEY" == pk_live_* ]]; then
  STRIPE_MODE="LIVE ⚠️"
else
  STRIPE_MODE="test"
fi

echo ""
echo "┌─ Android AAB build ────────────────────────────────────┐"
printf "│  %-20s %s\n" "versionName:"  "$VERSION_NAME"
printf "│  %-20s %s\n" "versionCode:"  "$NEW_CODE"
printf "│  %-20s %s\n" "API:"          "${API_BASE:-NOT SET}"
printf "│  %-20s %s\n" "Stripe:"       "${STRIPE_MODE:-NOT SET}"
printf "│  %-20s %s\n" "APP_ENV:"      "${APP_ENV:-NOT SET}"
echo "└────────────────────────────────────────────────────────┘"
echo ""

if [[ "$STRIPE_KEY" == pk_live_* ]]; then
  echo "[prod] WARNING: building with a LIVE Stripe key — real money will be charged."
  echo "[prod] Make sure this is intentional before uploading to Play Console."
  echo ""
fi

# ── Build ─────────────────────────────────────────────────────────────────────

echo "[prod] Building release AAB..."
(
  cd android
  ./gradlew app:bundleRelease \
    -PappVersionCode="$NEW_CODE" \
    -PappVersionName="$VERSION_NAME" \
    -PANDROID_UPLOAD_STORE_FILE="$ANDROID_UPLOAD_STORE_FILE" \
    -PANDROID_UPLOAD_STORE_PASSWORD="$ANDROID_UPLOAD_STORE_PASSWORD" \
    -PANDROID_UPLOAD_KEY_ALIAS="$ANDROID_UPLOAD_KEY_ALIAS" \
    -PANDROID_UPLOAD_KEY_PASSWORD="$ANDROID_UPLOAD_KEY_PASSWORD"
)

if [ ! -f "$AAB_PATH" ]; then
  echo "[prod] AAB not found at $AAB_PATH"
  exit 1
fi

echo ""
echo "[prod] ✓ AAB ready: $AAB_PATH"
echo "[prod]   versionCode=$NEW_CODE  versionName=$VERSION_NAME"
echo "[prod]   Commit the versionCode bump in app.json before your next build."
