#!/usr/bin/env bash
# Pull the pinned ECR images and (re)start the stack, then run DB migrations.
# Re-run any time you bump API_TAG/WEB_TAG in .env.
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "Missing .env (cp .env.example .env and fill it in)"; exit 1; }
set -a; . ./.env; set +a

echo "==> ECR login (token valid ~12h)"
aws ecr get-login-password --region eu-west-1 \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "==> Pulling images  api:$API_TAG  web:$WEB_TAG"
docker compose -f compose.prod.yml pull

echo "==> Starting stack"
docker compose -f compose.prod.yml up -d

echo "==> Running DB migrations"
docker compose -f compose.prod.yml exec -T api npm --workspace apps/api run migrate:dist

echo "==> Up. Local health checks:"
curl -fsS --resolve api.freespace.ie:443:127.0.0.1 https://api.freespace.ie/health && echo " api OK"
echo "    (web: open https://freespace.ie once DNS points here)"
