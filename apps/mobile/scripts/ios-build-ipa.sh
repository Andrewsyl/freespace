#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$MOBILE_DIR/ios"
APP_JSON="$MOBILE_DIR/app.json"
DEFAULT_CREDENTIALS_JSON="$MOBILE_DIR/credentials.json"

WORKSPACE="$IOS_DIR/FreeSpace.xcworkspace"
SCHEME="FreeSpace"
ARCHIVE_PATH="$IOS_DIR/build/FreeSpace.xcarchive"
EXPORT_DIR="$IOS_DIR/build/export"
IPA_PATH="$EXPORT_DIR/FreeSpace.ipa"
RELEASE_ENTITLEMENTS="$IOS_DIR/FreeSpace/FreeSpace.release.entitlements"

# ── Team ID ──────────────────────────────────────────────────────────────────

load_ios_credentials() {
  if [ -z "${APPLE_TEAM_ID:-}" ]; then
    if [ -f "$DEFAULT_CREDENTIALS_JSON" ]; then
      local team_id
      team_id="$(node -e "
        const fs = require('fs');
        const d = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
        const t = d && d.ios && d.ios.teamId;
        if (!t || t === 'YOUR_APPLE_TEAM_ID') process.exit(2);
        process.stdout.write(t);
      " "$DEFAULT_CREDENTIALS_JSON" 2>/dev/null)" || return 1
      APPLE_TEAM_ID="$team_id"
      export APPLE_TEAM_ID
    fi
  fi
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
</dict>
</plist>
PLIST

# ── Archive ───────────────────────────────────────────────────────────────────

echo "[prod] Archiving..."
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  MARKETING_VERSION="$VERSION_NAME" \
  CURRENT_PROJECT_VERSION="$NEW_BUILD" \
  CODE_SIGN_ENTITLEMENTS="FreeSpace/FreeSpace.release.entitlements" \
  | xcpretty 2>/dev/null || true

if [ ! -d "$ARCHIVE_PATH" ]; then
  echo "[prod] Archive failed — re-running without xcpretty for full output:"
  xcodebuild archive \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    -destination "generic/platform=iOS" \
    -allowProvisioningUpdates \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
    MARKETING_VERSION="$VERSION_NAME" \
    CURRENT_PROJECT_VERSION="$NEW_BUILD" \
    CODE_SIGN_ENTITLEMENTS="FreeSpace/FreeSpace.release.entitlements"
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
echo "[prod]   Upload to TestFlight via Xcode → Organizer, or:"
echo "[prod]   xcrun altool --upload-app -f \"$IPA_PATH\" -t ios --apiKey KEY --apiIssuer ISSUER"
echo "[prod]   Commit the buildNumber bump in app.json before your next build."
