#!/usr/bin/env bash
set -euo pipefail

: "${LIGHTSAIL_HOST:?Set LIGHTSAIL_HOST}"
: "${LIGHTSAIL_USER:=ubuntu}"
: "${LIGHTSAIL_SSH_KEY_PATH:?Set LIGHTSAIL_SSH_KEY_PATH}"
: "${LIGHTSAIL_REPO_DIR:=/home/ubuntu/freespace}"
: "${DEPLOY_SERVICE:?Set DEPLOY_SERVICE to api or web}"
: "${DEPLOY_TAG:?Set DEPLOY_TAG to the ECR image tag}"

case "$DEPLOY_SERVICE" in
  api|web) ;;
  *)
    echo "DEPLOY_SERVICE must be api or web"
    exit 1
    ;;
esac

if [ ! -f "$LIGHTSAIL_SSH_KEY_PATH" ]; then
  echo "SSH key not found: $LIGHTSAIL_SSH_KEY_PATH"
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
known_hosts="$tmp_dir/known_hosts"
ssh-keyscan -H "$LIGHTSAIL_HOST" > "$known_hosts" 2>/dev/null

remote_tag_var="$(printf '%s' "$DEPLOY_SERVICE" | tr '[:lower:]' '[:upper:]')_TAG"
remote_cmd=$(cat <<EOF
set -euo pipefail
cd "$LIGHTSAIL_REPO_DIR"
git pull --ff-only
$remote_tag_var="$DEPLOY_TAG" ./deploy/lightsail/redeploy.sh
EOF
)

ssh \
  -i "$LIGHTSAIL_SSH_KEY_PATH" \
  -o UserKnownHostsFile="$known_hosts" \
  -o StrictHostKeyChecking=yes \
  "$LIGHTSAIL_USER@$LIGHTSAIL_HOST" \
  "$remote_cmd"
