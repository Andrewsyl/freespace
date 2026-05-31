#!/bin/sh
set -eu

api_log="$(mktemp)"
api_pid=""

cleanup() {
  if [ -n "$api_pid" ]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  rm -f "$api_log"
}

trap cleanup EXIT INT TERM

echo "web-e2e: starting api on 127.0.0.1:4000"
PORT=4000 \
WEB_BASE_URL=http://127.0.0.1:3100 \
PUBLIC_API_BASE_URL=http://127.0.0.1:4000 \
NODE_ENV=test \
npm --workspace apps/api run start >"$api_log" 2>&1 &
api_pid="$!"

attempt=0
until curl -sf http://127.0.0.1:4000/health >/dev/null; do
  attempt=$((attempt + 1))

  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "web-e2e: api exited before becoming healthy"
    cat "$api_log"
    exit 1
  fi

  if [ "$attempt" -ge 60 ]; then
    echo "web-e2e: api failed to become healthy in time"
    cat "$api_log"
    exit 1
  fi

  sleep 1
done

echo "web-e2e: api is healthy"
npm --workspace apps/web run test:e2e -- --workers=1 --reporter=line "$@"
