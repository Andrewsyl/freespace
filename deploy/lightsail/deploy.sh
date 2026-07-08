#!/usr/bin/env bash
# Pull the pinned ECR images and restart only the requested service.
# API deploys run DB migrations; web-only deploys skip them to avoid doing
# unnecessary work on the small Lightsail box.
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "Missing .env (cp .env.example .env and fill it in)"; exit 1; }
set -a; . ./.env; set +a

DEPLOY_SERVICE="${DEPLOY_SERVICE:-all}"

case "$DEPLOY_SERVICE" in
  api)
    compose_targets=(api)
    ;;
  web)
    compose_targets=(web)
    ;;
  all)
    compose_targets=()
    ;;
  *)
    echo "DEPLOY_SERVICE must be one of: api, web, all" >&2
    exit 1
    ;;
esac

echo "==> ECR login (token valid ~12h)"
aws ecr get-login-password --region eu-west-1 \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "==> Pulling images  api:$API_TAG  web:$WEB_TAG"
if [ "${#compose_targets[@]}" -eq 0 ]; then
  docker compose -f compose.prod.yml pull
else
  docker compose -f compose.prod.yml pull "${compose_targets[@]}"
fi

echo "==> Starting stack"
if [ "${#compose_targets[@]}" -eq 0 ]; then
  docker compose -f compose.prod.yml up -d
else
  docker compose -f compose.prod.yml up -d "${compose_targets[@]}"
fi

if [ "$DEPLOY_SERVICE" != "web" ]; then
  echo "==> Running DB migrations"
  docker compose -f compose.prod.yml exec -T api npm --workspace apps/api run migrate:dist
fi

if [ "$DEPLOY_SERVICE" != "web" ]; then
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
fi

if [ "$DEPLOY_SERVICE" != "api" ]; then
  echo "==> Waiting for web to respond"
  web_ok=false
  for attempt in $(seq 1 30); do
    if curl -fsS --resolve freespace.ie:443:127.0.0.1 https://freespace.ie/ >/dev/null 2>&1; then
      echo " web OK (after $attempt attempt(s))"
      web_ok=true
      break
    fi
    sleep 2
  done
  if [ "$web_ok" != true ]; then
    echo "Web did not return HTTP 200 within ~60s" >&2
    docker compose -f compose.prod.yml logs --tail=50 web >&2 || true
    exit 1
  fi
fi
