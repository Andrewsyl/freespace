#!/usr/bin/env bash
# Assemble .env on the box by pulling the API secrets from Secrets Manager and
# merging in the image tags + AWS creds. Keeps secret values on the box only.
#
# NOTE: the GitHub Actions deploy runs the copy of this script that lives ON THE
# BOX (/home/ubuntu/freespace/make-env.sh), not this repo copy — there is no
# auto-sync. If you change this file, scp it to the box too, or the change won't
# take effect. This copy is kept in sync so the repo reflects what actually runs.
#
# Requires (exported before running):
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  (the freespace-lightsail user)
#   API_TAG / WEB_TAG                          (ECR image tags to run)
# The IAM user needs secretsmanager:GetSecretValue on freespace/api-* for this.
set -euo pipefail
cd "$(dirname "$0")"

: "${AWS_ACCESS_KEY_ID:?export AWS_ACCESS_KEY_ID first}"
: "${AWS_SECRET_ACCESS_KEY:?export AWS_SECRET_ACCESS_KEY first}"
: "${API_TAG:?export API_TAG first}"
: "${WEB_TAG:?export WEB_TAG first}"
export AWS_DEFAULT_REGION=eu-west-1

SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id freespace/api --query SecretString --output text)
get() { printf '%s' "$SECRET_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))"; }

# Pre-launch we run live Stripe *test* keys in production on purpose; the API
# refuses to boot with a test key under NODE_ENV=production unless this is set.
# When flipping to live: put pk_live_/sk_live_ in Secrets Manager and set this
# to false (or drop the line), then redeploy.
ALLOW_TEST_STRIPE_KEYS_IN_PRODUCTION="${ALLOW_TEST_STRIPE_KEYS_IN_PRODUCTION:-true}"

umask 077
cat > .env <<EOF
ECR_REGISTRY=530726524685.dkr.ecr.eu-west-1.amazonaws.com
API_TAG=$API_TAG
WEB_TAG=$WEB_TAG

DATABASE_URL=$(get DATABASE_URL)
JWT_SECRET=$(get JWT_SECRET)
STRIPE_SECRET_KEY=$(get STRIPE_SECRET_KEY)
STRIPE_PUBLISHABLE_KEY=$(get STRIPE_PUBLISHABLE_KEY)
STRIPE_WEBHOOK_SECRET=$(get STRIPE_WEBHOOK_SECRET)
ALLOW_TEST_STRIPE_KEYS_IN_PRODUCTION=$ALLOW_TEST_STRIPE_KEYS_IN_PRODUCTION
RESEND_API_KEY=$(get RESEND_API_KEY)
SMTP_HOST=$(get SMTP_HOST)
SMTP_PORT=$(get SMTP_PORT)
SMTP_USER=$(get SMTP_USER)
SMTP_PASS=$(get SMTP_PASS)

AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
EOF
echo "==> Wrote .env ($(grep -c = .env) keys). Review it, then run ./deploy.sh"
