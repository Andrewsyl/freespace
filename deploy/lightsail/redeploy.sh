#!/usr/bin/env bash
# One-command Lightsail redeploy for the API/web stack.
# Run this on the Lightsail box from the repo root or deploy/lightsail directory.
set -euo pipefail

cd "$(dirname "$0")"

[ -f .env ] || { echo "Missing .env. Run make-env.sh first."; exit 1; }

# Load the current box env so we keep the existing web tag, AWS creds, and base settings.
set -a
. ./.env
set +a

: "${WEB_TAG:?WEB_TAG missing from .env}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID missing from .env}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY missing from .env}"
: "${API_TAG:=$(git rev-parse HEAD)}"

export API_TAG WEB_TAG AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

echo "==> Redeploying Lightsail with API_TAG=$API_TAG"

./make-env.sh
./deploy.sh
