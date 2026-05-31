#!/bin/sh
set -eu

echo "pre-push: checking local environment"
yarn check:env:local

echo "pre-push: checking migrations"
yarn check:migrations

echo "pre-push: building api"
yarn build:api

echo "pre-push: typechecking mobile"
yarn typecheck:mobile

echo "pre-push: clearing stale Next build output"
rm -rf apps/web/.next

echo "pre-push: building web"
yarn build:web

echo "pre-push: resetting Next build output for e2e"
rm -rf apps/web/.next

echo "pre-push: running web e2e"
e2e_log="$(mktemp)"
if npm --workspace apps/web run test:e2e -- --workers=1 --reporter=line 2>&1 | tee "$e2e_log"; then
  rm -f "$e2e_log"
else
  if grep -q 'MachPortRendezvousServer.*Permission denied (1100)' "$e2e_log"; then
    echo "pre-push: skipping local web e2e because Chromium launch is blocked by this macOS session"
    rm -f "$e2e_log"
  else
    rm -f "$e2e_log"
    exit 1
  fi
fi
