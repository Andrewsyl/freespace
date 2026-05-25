#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[check] Verifying lane scripts"
node -e 'const p=require("./package.json"); console.log("android:local =", p.scripts["android:local"]); console.log("android:prod  =", p.scripts["android:prod"]);'

echo "[check] Verifying Firebase package mappings"
if [ -f "android/app/google-services.json" ]; then
  rg -n '"package_name": "ie\.freespace\.app(\.dev)?"' android/app/google-services.json || true
else
  echo "[check][warn] Missing android/app/google-services.json"
fi

echo "[check] Current API bases"
for f in .env.local.source .env.dev .env.qa .env.production; do
  if [ -f "$f" ]; then
    echo -n "$f -> "
    rg -n "^EXPO_PUBLIC_API_BASE=" "$f" | sed 's/^[0-9]*://'
  fi
done

echo "[check] Done"
