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

echo "pre-push: building web"
yarn build:web

echo "pre-push: running web e2e"
npm --workspace apps/web run test:e2e -- --workers=1 --reporter=line
