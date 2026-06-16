#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:=eu-west-1}"
: "${AWS_PROFILE:=default}"
: "${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID}"
: "${ECR_REPOSITORY:=freespace-api}"
: "${IMAGE_TAG:=$(git rev-parse HEAD)}"

IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"

echo "Building ${IMAGE_URI}"
docker build --platform linux/amd64 -f apps/api/Dockerfile -t "${IMAGE_URI}" .

aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" ecr get-login-password \
  | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker push "${IMAGE_URI}"

echo "Pushed ${IMAGE_URI}"
