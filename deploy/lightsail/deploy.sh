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

echo "==> Waiting for API to become healthy (the container needs a few seconds to boot)"
api_ok=false
for attempt in $(seq 1 30); do
  if curl -fsS --resolve api.freespace.ie:443:127.0.0.1 https://api.freespace.ie/health >/dev/null 2>&1; then
    echo " api OK (after $attempt attempt(s))"
    api_ok=true
    break
  fi
  sleep 2
done
if [ "$api_ok" != true ]; then
  echo "API did not return a healthy /health within ~60s" >&2
  docker compose -f compose.prod.yml logs --tail=50 api >&2 || true
  exit 1
fi
echo "    (web: open https://freespace.ie once DNS points here)"
