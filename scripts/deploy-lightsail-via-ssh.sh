#!/usr/bin/env bash
set -euo pipefail

: "${LIGHTSAIL_HOST:?Set LIGHTSAIL_HOST}"
: "${LIGHTSAIL_USER:=ubuntu}"
: "${LIGHTSAIL_REPO_DIR:=/home/ubuntu/freespace}"
: "${DEPLOY_SERVICE:?Set DEPLOY_SERVICE to api or web}"
: "${DEPLOY_TAG:?Set DEPLOY_TAG to the ECR image tag}"

if [ -n "${LIGHTSAIL_SSH_KEY_PATH:-}" ]; then
  ssh_key_path="$LIGHTSAIL_SSH_KEY_PATH"
elif [ -n "${LIGHTSAIL_SSH_KEY:-}" ]; then
  ssh_key_path="$(mktemp)"
  printf '%s\n' "$LIGHTSAIL_SSH_KEY" > "$ssh_key_path"
  chmod 600 "$ssh_key_path"
else
  echo "Set LIGHTSAIL_SSH_KEY or LIGHTSAIL_SSH_KEY_PATH"
  exit 1
fi

case "$ssh_key_path" in
  "~/"*) ssh_key_path="$HOME/${ssh_key_path#~/}" ;;
  "~") ssh_key_path="$HOME" ;;
esac

ssh_cert_path=""
if [ -n "${LIGHTSAIL_SSH_CERT_PATH:-}" ]; then
  ssh_cert_path="$LIGHTSAIL_SSH_CERT_PATH"
elif [ -n "${LIGHTSAIL_SSH_CERT:-}" ]; then
  ssh_cert_path="$(mktemp)"
  printf '%s\n' "$LIGHTSAIL_SSH_CERT" > "$ssh_cert_path"
  chmod 600 "$ssh_cert_path"
fi

if [ -n "$ssh_cert_path" ]; then
  case "$ssh_cert_path" in
    "~/"*) ssh_cert_path="$HOME/${ssh_cert_path#~/}" ;;
    "~") ssh_cert_path="$HOME" ;;
  esac
fi

case "$DEPLOY_SERVICE" in
  api|web) ;;
  *)
    echo "DEPLOY_SERVICE must be api or web"
    exit 1
    ;;
esac

if [ ! -f "$ssh_key_path" ]; then
  echo "SSH key not found: $ssh_key_path"
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir" "${ssh_key_path:-}"' EXIT
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

ssh_args=(
  -i "$ssh_key_path"
  -o UserKnownHostsFile="$known_hosts"
  -o StrictHostKeyChecking=yes
)

if [ -n "$ssh_cert_path" ]; then
  ssh_args+=(-o "CertificateFile=$ssh_cert_path")
fi

ssh "${ssh_args[@]}" "$LIGHTSAIL_USER@$LIGHTSAIL_HOST" "$remote_cmd"
