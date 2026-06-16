#!/usr/bin/env bash
# Assemble .env on the box by pulling the API secrets from Secrets Manager and
# merging in the image tags + AWS creds. Keeps secret values on the box only.
#
# Requires (exported before running):
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  (the freespace-lightsail user)
#   API_TAG / WEB_TAG                          (ECR image tags to run)
# Optional overrides:
#   STRIPE_MODE=test|live                      (switch Stripe source without editing the script)
#   STRIPE_TEST_SECRET_KEY / STRIPE_TEST_WEBHOOK_SECRET
#                                              (used when STRIPE_MODE=test)
#   STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET  (override Secrets Manager values in live mode)
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

STRIPE_MODE="${STRIPE_MODE:-live}"
case "$STRIPE_MODE" in
  test|live) ;;
  *)
    echo "Unsupported STRIPE_MODE: $STRIPE_MODE (expected test or live)"
    exit 1
    ;;
esac

if [ "$STRIPE_MODE" = "test" ]; then
  : "${STRIPE_TEST_SECRET_KEY:?export STRIPE_TEST_SECRET_KEY first}"
  : "${STRIPE_TEST_WEBHOOK_SECRET:?export STRIPE_TEST_WEBHOOK_SECRET first}"
  STRIPE_SECRET_KEY="$STRIPE_TEST_SECRET_KEY"
  STRIPE_WEBHOOK_SECRET="$STRIPE_TEST_WEBHOOK_SECRET"
else
  STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-$(get STRIPE_SECRET_KEY)}"
  STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-$(get STRIPE_WEBHOOK_SECRET)}"
fi

umask 077
cat > .env <<EOF
ECR_REGISTRY=530726524685.dkr.ecr.eu-west-1.amazonaws.com
API_TAG=$API_TAG
WEB_TAG=$WEB_TAG

DATABASE_URL=$(get DATABASE_URL)
JWT_SECRET=$(get JWT_SECRET)
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
RESEND_API_KEY=$(get RESEND_API_KEY)
SMTP_HOST=$(get SMTP_HOST)
SMTP_PORT=$(get SMTP_PORT)
SMTP_USER=$(get SMTP_USER)
SMTP_PASS=$(get SMTP_PASS)

AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_REGION=eu-west-1

NODE_ENV=production
PORT=8080
WEB_BASE_URL=https://freespace.ie
S3_BUCKET_NAME=freespace-uploads-530726524685-eu-west-1
STRIPE_CONNECT_ENABLED=true
NOTIFICATION_PROCESSOR_INTERVAL_MS=60000
EMAIL_FROM=FreeSpace <hello@freespace.ie>
EMAIL_FROM_SUPPORT=FreeSpace Support <support@freespace.ie>
EMAIL_FROM_BOOKINGS=FreeSpace Bookings <booking@freespace.ie>
EMAIL_FROM_SIGNUP=FreeSpace Accounts <accounts@freespace.ie>
SUPPORT_EMAIL=support@freespace.ie
GOOGLE_OAUTH_CLIENT_ID=427792130041-s3dlgu4vsq0t7oujuhbev0tgqhvt0dk7.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=742052774291-7ebm33putsqqjjb8h5kebok0214hp38h.apps.googleusercontent.com
EOF
echo "==> Wrote .env ($(grep -c = .env) keys). Review it, then run ./deploy.sh"
