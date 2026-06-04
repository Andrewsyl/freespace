#!/bin/sh
set -eu

export DATABASE_URL="${DATABASE_URL:-postgres://test:test@localhost:5432/carparking_test}"
export JWT_SECRET="${JWT_SECRET:-test-jwt-secret-123456}"
export WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"
export NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE:-http://localhost:4000}"
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-test-google-maps-key}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_123456789}"
export NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:-test-google-web-client}"
export EXPO_PUBLIC_API_BASE="${EXPO_PUBLIC_API_BASE:-http://127.0.0.1:4000}"
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:-test-google-maps-key}"
export EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY="${EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_123456789}"
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_123456789}"

echo "pre-push: checking local environment"
yarn check:env:local

echo "pre-push: checking migrations"
yarn check:migrations

echo "pre-push: checking firebase config"
yarn check:firebase

echo "pre-push: building api"
yarn build:api

echo "pre-push: running api tests"
yarn test:api

echo "pre-push: typechecking mobile"
yarn typecheck:mobile

echo "pre-push: running mobile tests"
yarn test:mobile -- --runInBand

echo "pre-push: clearing stale Next build output"
rm -rf apps/web/.next

echo "pre-push: linting web"
yarn lint:web

echo "pre-push: building web"
yarn build:web

echo "pre-push: resetting Next build output for e2e"
rm -rf apps/web/.next

echo "pre-push: running web e2e"
e2e_log="$(mktemp)"
if yarn test:web:e2e:local >"$e2e_log" 2>&1; then
  cat "$e2e_log"
  rm -f "$e2e_log"
else
  cat "$e2e_log"
  if grep -q 'MachPortRendezvousServer.*Permission denied (1100)' "$e2e_log"; then
    echo "pre-push: skipping local web e2e because Chromium launch is blocked by this macOS session"
    rm -f "$e2e_log"
  else
    rm -f "$e2e_log"
    exit 1
  fi
fi
