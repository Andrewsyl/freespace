# ECS Fargate Migration For `apps/api`

This replaces Elastic Beanstalk for the API only. Keep the web app where it is until the API cutover is stable.

## What this setup uses

- Docker image built from `apps/api/Dockerfile`
- ECR repository: `freespace-api`
- ECS Fargate service behind an ALB
- Route53 alias: `api.freespace.ie`
- CloudWatch log group: `/ecs/freespace-api`
- Secrets Manager or SSM Parameter Store for runtime secrets
- Current service name in AWS: `freespace-api-v2`

## 1. Create the ECR repository

```bash
aws --profile freespace --region eu-west-1 ecr create-repository \
  --repository-name freespace-api \
  --image-scanning-configuration scanOnPush=true
```

## 2. Build and push the API image

```bash
AWS_PROFILE=freespace \
AWS_REGION=eu-west-1 \
AWS_ACCOUNT_ID=530726524685 \
ECR_REPOSITORY=freespace-api \
IMAGE_TAG=$(git rev-parse --short HEAD) \
scripts/build-push-ecs-api.sh
```

## 3. Create runtime secrets

Store these in Secrets Manager or Parameter Store:

- `DATABASE_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `SENTRY_DSN`
- `ERROR_REPORT_WEBHOOK_URL`
- any OAuth secrets you actually use

The task definition template assumes a single Secrets Manager secret named `freespace/api` with JSON keys.
Do not include empty optional URL secrets in the task definition. ECS treats missing JSON keys as startup failures.

## 4. Register the task definition

Start from:

- `infra/ecs/api-task-definition.template.json`

Replace:

- account ids
- role arns
- image uri
- any optional env values you want to omit

Register it:

```bash
aws --profile freespace --region eu-west-1 ecs register-task-definition \
  --cli-input-json file://infra/ecs/api-task-definition.template.json
```

## 5. Create the ECS service

Use:

- cluster: `freespace-prod`
- service: `freespace-api-v2`
- desired count: `2`
- deployment circuit breaker with rollback enabled
- ALB target group with `HTTP /health`

Reference:

- `infra/ecs/api-service-notes.md`

## 6. Create the ALB target group correctly

The critical health check settings are:

- path: `/health`
- protocol: `HTTP`
- matcher: `200`
- target type: `ip`

Do not use HTTPS for the target group health check. TLS terminates at the ALB.

## 6.5 Database access

Allow inbound PostgreSQL access from the ECS task security group to the RDS security group.

Without that rule, the API can start but database checks and requests will time out.

## 7. Cut over DNS

Point:

- `api.freespace.ie`

to the ALB as a Route53 alias.

Reduce TTL ahead of time if you are using a non-alias record today.

## 8. Post-cutover checks

Run:

```bash
curl -i https://api.freespace.ie/health
npm run smoke:post-deploy
```

Check:

- CloudWatch logs in `/ecs/freespace-api`
- Stripe webhook delivery
- password reset email
- login / booking happy path

## 9. Migrations

Run migrations as a one-off task using the same image:

```bash
aws --profile freespace --region eu-west-1 ecs run-task \
  --cluster freespace-prod \
  --launch-type FARGATE \
  --task-definition freespace-api \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-abc,subnet-def],securityGroups=[sg-abc],assignPublicIp=DISABLED}' \
  --overrides '{"containerOverrides":[{"name":"api","command":["npm","--workspace","apps/api","run","migrate:dist"]}]}'
```

Run the migration task before shifting production traffic.

## 10. Rollback

Rollback is:

1. point the ECS service to the previous task definition revision
2. if needed, point `api.freespace.ie` back to the old target

This is materially cleaner than EB because the running task definition revision is explicit.

## Notes specific to this repo

- The API listens on port `8080`
- The API enforces HTTPS in production, but `/health` now bypasses redirect so the ALB can health check over HTTP
- The image copies `db/migrations` so startup checks and one-off migrations work
- The Docker build expects the repo root as build context:

```bash
docker build -f apps/api/Dockerfile .
```
