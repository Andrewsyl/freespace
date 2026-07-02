#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$MOBILE_DIR/ios"
APP_JSON="$MOBILE_DIR/app.json"
DEFAULT_CREDENTIALS_JSON="$MOBILE_DIR/credentials.json"

WORKSPACE="$IOS_DIR/FreeSpace.xcworkspace"
PROJECT="$IOS_DIR/FreeSpace.xcodeproj"
SCHEME="FreeSpace"
ARCHIVE_PATH="$IOS_DIR/build/FreeSpace.xcarchive"
EXPORT_DIR="$IOS_DIR/build/export"
IPA_PATH="$EXPORT_DIR/FreeSpace.ipa"
RELEASE_ENTITLEMENTS="$IOS_DIR/FreeSpace/FreeSpace.release.entitlements"

XCODEBUILD_CONTAINER=(-workspace "$WORKSPACE")
if ! xcodebuild -list -workspace "$WORKSPACE" >/dev/null 2>&1; then
  XCODEBUILD_CONTAINER=(-project "$PROJECT")
fi

# ── Team ID ──────────────────────────────────────────────────────────────────

load_ios_credentials() {
  [ -f "$DEFAULT_CREDENTIALS_JSON" ] || return 0
  local json="$DEFAULT_CREDENTIALS_JSON"

  _cred() {
    node -e "
      const d = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      const v = (d.ios || {})[process.argv[2]] || '';
      process.stdout.write(v);
    " "$json" "$1" 2>/dev/null
  }

  local team_id; team_id="$(_cred teamId)"
  if [ -z "$team_id" ] || [ "$team_id" = "YOUR_APPLE_TEAM_ID" ]; then return 1; fi

  [ -z "${APPLE_TEAM_ID:-}" ]              && { APPLE_TEAM_ID="$team_id"; export APPLE_TEAM_ID; }
  [ -z "${APPLE_ID:-}" ]                   && { APPLE_ID="$(_cred appleId)"; export APPLE_ID; }
  [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] && { APPLE_APP_SPECIFIC_PASSWORD="$(_cred appSpecificPassword)"; export APPLE_APP_SPECIFIC_PASSWORD; }
}

load_ios_credentials || true

if [ -z "${APPLE_TEAM_ID:-}" ]; then
  cat <<'EOF'
[prod] Missing Apple Team ID for iOS IPA build.

Set it in apps/mobile/credentials.json under ios.teamId:
  {
    "ios": { "teamId": "XXXXXXXXXX" }
  }

Your Team ID is at developer.apple.com → Account → Membership → Team ID.
It is a 10-character string like "A1B2C3D4E5".

Or pass it directly:
  APPLE_TEAM_ID=XXXXXXXXXX npm run ios:prod:ipa
EOF
  exit 1
fi

# ── Version number ───────────────────────────────────────────────────────────
# Read buildNumber from app.json, increment by 1, write back.
# Xcode's CURRENT_PROJECT_VERSION is overridden at build time via
# CURRENT_PROJECT_VERSION build setting — no .pbxproj edits needed.

read_ios_version() {
  node -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    process.stdout.write(JSON.stringify({
      build: parseInt(d.expo.ios.buildNumber || '1', 10),
      version: d.expo.version,
    }));
  " "$APP_JSON"
}

bump_build_number() {
  local new_build="$1"
  node -e "
    const fs = require('fs');
    const path = process.argv[1];
    const d = JSON.parse(fs.readFileSync(path, 'utf8'));
    d.expo.ios.buildNumber = String(parseInt(process.argv[2], 10));
    fs.writeFileSync(path, JSON.stringify(d, null, 2) + '\n', 'utf8');
  " "$APP_JSON" "$new_build"
}

VERSION_INFO="$(read_ios_version)"
CURRENT_BUILD="$(node -e "process.stdout.write(String(JSON.parse(process.argv[1]).build))" "$VERSION_INFO")"
VERSION_NAME="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).version)" "$VERSION_INFO")"
NEW_BUILD=$(( CURRENT_BUILD + 1 ))

bump_build_number "$NEW_BUILD"
echo "[prod] buildNumber bumped: $CURRENT_BUILD → $NEW_BUILD"

# ── Pre-flight summary ────────────────────────────────────────────────────────

STRIPE_KEY="${EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}"
API_BASE="${EXPO_PUBLIC_API_BASE:-}"

if [[ "$STRIPE_KEY" == pk_live_* ]]; then
  STRIPE_MODE="LIVE ⚠️"
else
  STRIPE_MODE="test"
fi

echo ""
echo "┌─ iOS IPA build ────────────────────────────────────────┐"
printf "│  %-20s %s\n" "version:"      "$VERSION_NAME"
printf "│  %-20s %s\n" "buildNumber:"  "$NEW_BUILD"
printf "│  %-20s %s\n" "teamId:"       "$APPLE_TEAM_ID"
printf "│  %-20s %s\n" "API:"          "${API_BASE:-NOT SET}"
printf "│  %-20s %s\n" "Stripe:"       "${STRIPE_MODE:-NOT SET}"
printf "│  %-20s %s\n" "APP_ENV:"      "${APP_ENV:-NOT SET}"
echo "└────────────────────────────────────────────────────────┘"
echo ""

if [[ "$STRIPE_KEY" == pk_live_* ]]; then
  echo "[prod] WARNING: building with a LIVE Stripe key — real money will be charged."
  echo "[prod] Make sure this is intentional before uploading to TestFlight."
  echo ""
fi

# ── ExportOptions plist (generated at build time) ────────────────────────────

mkdir -p "$IOS_DIR/build"
EXPORT_OPTIONS_PLIST="$IOS_DIR/build/ExportOptions.plist"

cat > "$EXPORT_OPTIONS_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>${APPLE_TEAM_ID}</string>
    <key>uploadSymbols</key>
    <true/>
    <key>compileBitcode</key>
    <false/>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.andrewsyl.carparking</key>
        <string>FreeSpace App Store</string>
    </dict>
</dict>
</plist>
PLIST

# ── Archive ───────────────────────────────────────────────────────────────────

echo "[prod] Archiving..."
XCODEBUILD_ARCHIVE_ARGS=(
  archive
  "${XCODEBUILD_CONTAINER[@]}"
  -scheme "$SCHEME"
  -configuration Release
  -archivePath "$ARCHIVE_PATH"
  -destination "generic/platform=iOS"
  -allowProvisioningUpdates
  -xcconfig "$IOS_DIR/release-signing.xcconfig"
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID"
  MARKETING_VERSION="$VERSION_NAME"
  CURRENT_PROJECT_VERSION="$NEW_BUILD"
  CODE_SIGN_ENTITLEMENTS="FreeSpace/FreeSpace.release.entitlements"
)

# xcpretty isn't installed on every machine — piping into a missing command
# under `set -o pipefail` kills xcodebuild with a broken pipe, which used to
# be masked by `|| true` and silently trigger a full second archive attempt.
# Check first so a normal run only archives once.
if command -v xcpretty >/dev/null 2>&1; then
  xcodebuild "${XCODEBUILD_ARCHIVE_ARGS[@]}" | xcpretty
else
  xcodebuild "${XCODEBUILD_ARCHIVE_ARGS[@]}"
fi

if [ ! -d "$ARCHIVE_PATH" ]; then
  echo "[prod] Archive failed."
  exit 1
fi

echo "[prod] Archive complete: $ARCHIVE_PATH"

# ── Export IPA ────────────────────────────────────────────────────────────────

echo "[prod] Exporting IPA..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"

if [ ! -f "$IPA_PATH" ]; then
  echo "[prod] IPA not found at $IPA_PATH"
  echo "[prod] Contents of export dir:"
  ls "$EXPORT_DIR" 2>/dev/null || true
  exit 1
fi

echo ""
echo "[prod] ✓ IPA ready: $IPA_PATH"
echo "[prod]   version=$VERSION_NAME  buildNumber=$NEW_BUILD"
echo ""

# ── Upload to TestFlight ──────────────────────────────────────────────────────

if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]; then
  echo "[prod] Uploading to TestFlight..."
  xcrun altool --upload-app \
    -f "$IPA_PATH" \
    -t ios \
    -u "$APPLE_ID" \
    -p "$APPLE_APP_SPECIFIC_PASSWORD" \
    --output-format xml
  echo "[prod] ✓ Uploaded — check App Store Connect → TestFlight in a few minutes."
else
  echo "[prod] Skipping upload (no APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD set)."
  echo "[prod]   Add appleId and appSpecificPassword to credentials.json to auto-upload."
fi

echo "[prod]   Commit the buildNumber bump in app.json before your next build."
