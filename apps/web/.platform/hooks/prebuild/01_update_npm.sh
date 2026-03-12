#!/bin/bash
set -e

echo "Ensuring npm is on a stable version to avoid install issues..."
NPM_TARGET="10.9.2"
CURRENT_NPM="$(npm --version || true)"

if [ "$CURRENT_NPM" = "$NPM_TARGET" ]; then
  echo "npm already at $NPM_TARGET"
  exit 0
fi

npm install -g npm@${NPM_TARGET} --force
npm --version
