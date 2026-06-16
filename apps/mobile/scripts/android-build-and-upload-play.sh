#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

"$SCRIPT_DIR/android-build-aab.sh"

RELEASE_NAME="${GOOGLE_PLAY_RELEASE_NAME:-$(node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("app.json","utf8")); process.stdout.write(`${d.expo.version} (${d.expo.android.versionCode})`);' "$MOBILE_DIR")}"

ARGS=(
  --aab-path "$MOBILE_DIR/android/app/build/outputs/bundle/release/app-release.aab"
  --package-name "${GOOGLE_PLAY_PACKAGE_NAME:-ie.freespace.app}"
  --track "${GOOGLE_PLAY_TRACK:-internal}"
  --release-name "$RELEASE_NAME"
  --notes "${GOOGLE_PLAY_RELEASE_NOTES:-Bug fixes and updates.}"
)

if [ -n "${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:-${GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH:-}}" ]; then
  ARGS+=(--service-account-json "${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:-${GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH:-}}")
fi

node "$SCRIPT_DIR/play-upload-aab.mjs" "${ARGS[@]}"
