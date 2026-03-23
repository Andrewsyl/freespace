#!/bin/zsh
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-freespace}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
ACCOUNT_ID="${ACCOUNT_ID:-530726524685}"

CLUSTER_NAME="${CLUSTER_NAME:-freespace-prod}"
SERVICE_NAME="${SERVICE_NAME:-freespace-api}"
TASK_FAMILY="${TASK_FAMILY:-freespace-api}"
ECR_REPOSITORY="${ECR_REPOSITORY:-freespace-api}"
IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest"
LOG_GROUP="${LOG_GROUP:-/ecs/freespace-api}"
SECRET_NAME="${SECRET_NAME:-freespace/api}"

VPC_ID="${VPC_ID:-vpc-01b8c6b11e679b456}"
PUBLIC_SUBNETS=(
  "${SUBNET_1:-subnet-007450008162a6b79}"
  "${SUBNET_2:-subnet-08442c6da98cb20cb}"
  "${SUBNET_3:-subnet-0ef8e491240e56280}"
)
CERT_ARN="${CERT_ARN:-arn:aws:acm:eu-west-1:530726524685:certificate/45a03eb7-60e2-46a7-82f6-f57b8b0382e5}"
ALB_NAME="${ALB_NAME:-freespace-api-alb}"
TG_NAME="${TG_NAME:-freespace-api-tg}"
ALB_SG_NAME="${ALB_SG_NAME:-freespace-api-alb-sg}"
TASK_SG_NAME="${TASK_SG_NAME:-freespace-api-tasks-sg}"
EXEC_ROLE_NAME="${EXEC_ROLE_NAME:-freespace-ecs-execution-role}"
TASK_ROLE_NAME="${TASK_ROLE_NAME:-freespace-api-task-role}"

aws_cmd() {
  aws --profile "$AWS_PROFILE" --region "$AWS_REGION" "$@"
}

json_escape() {
  python3 - <<'PY' "$1"
import json, sys
print(json.dumps(sys.argv[1]))
PY
}

echo "Reading current EB application env"
ENV_JSON="$(
  aws_cmd elasticbeanstalk describe-configuration-settings \
    --application-name 'FreeSpace' \
    --environment-name FreeSpace-env-api \
    --query "ConfigurationSettings[0].OptionSettings[?Namespace=='aws:elasticbeanstalk:application:environment'].[OptionName,Value]" \
    --output json
)"

eb_env() {
  local key="$1"
  ENV_JSON_INPUT="$ENV_JSON" python3 -c '
import json, os, sys
target = sys.argv[1]
rows = json.loads(os.environ["ENV_JSON_INPUT"])
for row in rows:
    if row[0] == target:
        print(row[1])
        break
' "$key"
}

DATABASE_URL="$(eb_env DATABASE_URL)"
JWT_SECRET="$(eb_env JWT_SECRET)"
STRIPE_SECRET_KEY="$(eb_env STRIPE_SECRET_KEY)"
STRIPE_WEBHOOK_SECRET="$(eb_env STRIPE_WEBHOOK_SECRET)"
RESEND_API_KEY="$(eb_env RESEND_API_KEY)"
SENTRY_DSN="$(eb_env SENTRY_DSN)"
ERROR_REPORT_WEBHOOK_URL="$(eb_env ERROR_REPORT_WEBHOOK_URL)"
SMTP_HOST="$(eb_env SMTP_HOST)"
SMTP_PORT="$(eb_env SMTP_PORT)"
SMTP_USER="$(eb_env SMTP_USER)"
SMTP_PASS="$(eb_env SMTP_PASS)"
S3_BUCKET_NAME="$(eb_env S3_BUCKET_NAME)"
GOOGLE_OAUTH_CLIENT_ID="$(eb_env GOOGLE_OAUTH_CLIENT_ID)"

if [[ -z "$DATABASE_URL" || -z "$JWT_SECRET" ]]; then
  echo "Missing critical EB env vars; refusing to continue" >&2
  exit 1
fi

echo "Ensuring ECR repository"
if ! aws_cmd ecr describe-repositories --repository-names "$ECR_REPOSITORY" >/dev/null 2>&1; then
  aws_cmd ecr create-repository --repository-name "$ECR_REPOSITORY" >/dev/null
fi

echo "Ensuring CloudWatch log group"
if ! aws_cmd logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --query "logGroups[?logGroupName=='$LOG_GROUP'].logGroupName" --output text | grep -q "$LOG_GROUP"; then
  aws_cmd logs create-log-group --log-group-name "$LOG_GROUP"
fi

echo "Ensuring ECS cluster"
if ! aws_cmd ecs describe-clusters --clusters "$CLUSTER_NAME" --query 'clusters[0].clusterName' --output text 2>/dev/null | grep -q "$CLUSTER_NAME"; then
  aws_cmd ecs create-cluster --cluster-name "$CLUSTER_NAME" >/dev/null
fi

echo "Ensuring Secrets Manager secret"
SECRET_PAYLOAD="$(python3 - <<'PY' "$DATABASE_URL" "$JWT_SECRET" "$STRIPE_SECRET_KEY" "$STRIPE_WEBHOOK_SECRET" "$RESEND_API_KEY" "$SENTRY_DSN" "$ERROR_REPORT_WEBHOOK_URL" "$SMTP_HOST" "$SMTP_PORT" "$SMTP_USER" "$SMTP_PASS"
import json, sys
keys = [
  "DATABASE_URL",
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "SENTRY_DSN",
  "ERROR_REPORT_WEBHOOK_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
]
values = sys.argv[1:]
print(json.dumps({k:v for k,v in zip(keys, values) if v}))
PY
)"
if aws_cmd secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
  aws_cmd secretsmanager update-secret --secret-id "$SECRET_NAME" --secret-string "$SECRET_PAYLOAD" >/dev/null
else
  aws_cmd secretsmanager create-secret --name "$SECRET_NAME" --secret-string "$SECRET_PAYLOAD" >/dev/null
fi
SECRET_ARN="$(aws_cmd secretsmanager describe-secret --secret-id "$SECRET_NAME" --query 'ARN' --output text)"

echo "Ensuring IAM execution role"
if ! aws_cmd iam get-role --role-name "$EXEC_ROLE_NAME" >/dev/null 2>&1; then
  aws_cmd iam create-role --role-name "$EXEC_ROLE_NAME" --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' >/dev/null
fi
aws_cmd iam attach-role-policy --role-name "$EXEC_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy >/dev/null || true
aws_cmd iam attach-role-policy --role-name "$EXEC_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite >/dev/null || true

echo "Ensuring IAM task role"
if ! aws_cmd iam get-role --role-name "$TASK_ROLE_NAME" >/dev/null 2>&1; then
  aws_cmd iam create-role --role-name "$TASK_ROLE_NAME" --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' >/dev/null
fi
aws_cmd iam attach-role-policy --role-name "$TASK_ROLE_NAME" --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/FreespaceUploadsS3Access" >/dev/null || true
aws_cmd iam put-role-policy --role-name "$TASK_ROLE_NAME" --policy-name FreeSpaceSnsPublish --policy-document '{
  "Version":"2012-10-17",
  "Statement":[{"Effect":"Allow","Action":"sns:Publish","Resource":"*"}]
}' >/dev/null

echo "Ensuring security groups"
alb_sg="$(aws_cmd ec2 describe-security-groups --filters Name=vpc-id,Values="$VPC_ID" Name=group-name,Values="$ALB_SG_NAME" --query 'SecurityGroups[0].GroupId' --output text)"
if [[ "$alb_sg" == "None" || -z "$alb_sg" ]]; then
  alb_sg="$(aws_cmd ec2 create-security-group --group-name "$ALB_SG_NAME" --description 'FreeSpace API ALB' --vpc-id "$VPC_ID" --query 'GroupId' --output text)"
fi
task_sg="$(aws_cmd ec2 describe-security-groups --filters Name=vpc-id,Values="$VPC_ID" Name=group-name,Values="$TASK_SG_NAME" --query 'SecurityGroups[0].GroupId' --output text)"
if [[ "$task_sg" == "None" || -z "$task_sg" ]]; then
  task_sg="$(aws_cmd ec2 create-security-group --group-name "$TASK_SG_NAME" --description 'FreeSpace API tasks' --vpc-id "$VPC_ID" --query 'GroupId' --output text)"
fi
aws_cmd ec2 authorize-security-group-ingress --group-id "$alb_sg" --ip-permissions '[
  {"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},
  {"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}
]' >/dev/null 2>&1 || true
aws_cmd ec2 authorize-security-group-ingress --group-id "$task_sg" --ip-permissions "[
  {\"IpProtocol\":\"tcp\",\"FromPort\":8080,\"ToPort\":8080,\"UserIdGroupPairs\":[{\"GroupId\":\"$alb_sg\"}]}
]" >/dev/null 2>&1 || true

echo "Ensuring ALB"
alb_arn="$(aws_cmd elbv2 describe-load-balancers --names "$ALB_NAME" --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || true)"
if [[ "$alb_arn" == "None" || -z "$alb_arn" ]]; then
  alb_arn="$(aws_cmd elbv2 create-load-balancer \
    --name "$ALB_NAME" \
    --type application \
    --scheme internet-facing \
    --security-groups "$alb_sg" \
    --subnets "${PUBLIC_SUBNETS[@]}" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)"
fi

echo "Ensuring target group"
tg_arn="$(aws_cmd elbv2 describe-target-groups --names "$TG_NAME" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || true)"
if [[ "$tg_arn" == "None" || -z "$tg_arn" ]]; then
  tg_arn="$(aws_cmd elbv2 create-target-group \
    --name "$TG_NAME" \
    --protocol HTTP \
    --port 8080 \
    --target-type ip \
    --vpc-id "$VPC_ID" \
    --health-check-protocol HTTP \
    --health-check-path /health \
    --matcher HttpCode=200 \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)"
fi

echo "Ensuring listeners"
http_listener="$(aws_cmd elbv2 describe-listeners --load-balancer-arn "$alb_arn" --query 'Listeners[?Port==`80`].ListenerArn' --output text)"
if [[ -z "$http_listener" || "$http_listener" == "None" ]]; then
  aws_cmd elbv2 create-listener \
    --load-balancer-arn "$alb_arn" \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' >/dev/null
fi
https_listener="$(aws_cmd elbv2 describe-listeners --load-balancer-arn "$alb_arn" --query 'Listeners[?Port==`443`].ListenerArn' --output text)"
if [[ -z "$https_listener" || "$https_listener" == "None" ]]; then
  aws_cmd elbv2 create-listener \
    --load-balancer-arn "$alb_arn" \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn="$CERT_ARN" \
    --ssl-policy ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09 \
    --default-actions Type=forward,TargetGroupArn="$tg_arn" >/dev/null
fi

echo "Registering task definition"
task_json="$(mktemp)"
cat > "$task_json" <<JSON
{
  "family": "${TASK_FAMILY}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${ACCOUNT_ID}:role/${EXEC_ROLE_NAME}",
  "taskRoleArn": "arn:aws:iam::${ACCOUNT_ID}:role/${TASK_ROLE_NAME}",
  "runtimePlatform": {
    "cpuArchitecture": "X86_64",
    "operatingSystemFamily": "LINUX"
  },
  "containerDefinitions": [
    {
      "name": "api",
      "image": "${IMAGE_URI}",
      "essential": true,
      "portMappings": [{"containerPort": 8080, "hostPort": 8080, "protocol": "tcp"}],
      "environment": [
        {"name":"NODE_ENV","value":"production"},
        {"name":"PORT","value":"8080"},
        {"name":"AWS_REGION","value":"eu-west-1"},
        {"name":"WEB_BASE_URL","value":"https://freespace.ie"},
        {"name":"ENFORCE_HTTPS","value":"true"},
        {"name":"STRIPE_CONNECT_ENABLED","value":"true"},
        {"name":"S3_BUCKET_NAME","value":"${S3_BUCKET_NAME}"},
        {"name":"GOOGLE_OAUTH_CLIENT_ID","value":"${GOOGLE_OAUTH_CLIENT_ID}"},
        {"name":"EMAIL_FROM","value":"FreeSpace <hello@freespace.ie>"},
        {"name":"EMAIL_FROM_SIGNUP","value":"FreeSpace Accounts <accounts@freespace.ie>"},
        {"name":"EMAIL_FROM_BOOKINGS","value":"FreeSpace Bookings <booking@freespace.ie>"},
        {"name":"EMAIL_FROM_SUPPORT","value":"FreeSpace Support <support@freespace.ie>"},
        {"name":"SUPPORT_EMAIL","value":"support@freespace.ie"}
      ],
      "secrets": [
        {"name":"DATABASE_URL","valueFrom":"${SECRET_ARN}:DATABASE_URL::"},
        {"name":"JWT_SECRET","valueFrom":"${SECRET_ARN}:JWT_SECRET::"},
        {"name":"STRIPE_SECRET_KEY","valueFrom":"${SECRET_ARN}:STRIPE_SECRET_KEY::"},
        {"name":"STRIPE_WEBHOOK_SECRET","valueFrom":"${SECRET_ARN}:STRIPE_WEBHOOK_SECRET::"},
        {"name":"RESEND_API_KEY","valueFrom":"${SECRET_ARN}:RESEND_API_KEY::"},
        {"name":"SMTP_HOST","valueFrom":"${SECRET_ARN}:SMTP_HOST::"},
        {"name":"SMTP_PORT","valueFrom":"${SECRET_ARN}:SMTP_PORT::"},
        {"name":"SMTP_USER","valueFrom":"${SECRET_ARN}:SMTP_USER::"},
        {"name":"SMTP_PASS","valueFrom":"${SECRET_ARN}:SMTP_PASS::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "${LOG_GROUP}",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "api"
        }
      }
    }
  ]
}
JSON

task_def_arn="$(aws_cmd ecs register-task-definition --cli-input-json "file://$task_json" --query 'taskDefinition.taskDefinitionArn' --output text)"
rm -f "$task_json"

echo "Ensuring ECS service with desired count 0"
service_arn="$(aws_cmd ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].serviceArn' --output text 2>/dev/null || true)"
if [[ "$service_arn" == "None" || -z "$service_arn" ]]; then
  aws_cmd ecs create-service \
    --cluster "$CLUSTER_NAME" \
    --service-name "$SERVICE_NAME" \
    --task-definition "$task_def_arn" \
    --desired-count 0 \
    --launch-type FARGATE \
    --deployment-configuration maximumPercent=200,minimumHealthyPercent=100 \
    --health-check-grace-period-seconds 60 \
    --network-configuration "awsvpcConfiguration={subnets=[${PUBLIC_SUBNETS[1]},${PUBLIC_SUBNETS[2]},${PUBLIC_SUBNETS[3]}],securityGroups=[$task_sg],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$tg_arn,containerName=api,containerPort=8080" >/dev/null
else
  aws_cmd ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "$task_def_arn" \
    --desired-count 0 >/dev/null
fi

echo
echo "Created/updated:"
echo "  Cluster: $CLUSTER_NAME"
echo "  ALB ARN: $alb_arn"
echo "  Target group: $tg_arn"
echo "  Task role: arn:aws:iam::${ACCOUNT_ID}:role/${TASK_ROLE_NAME}"
echo "  Execution role: arn:aws:iam::${ACCOUNT_ID}:role/${EXEC_ROLE_NAME}"
echo "  Secret: $SECRET_ARN"
echo "  Task definition: $task_def_arn"
echo "  Service: $SERVICE_NAME (desired count 0)"
echo "  Image expected: $IMAGE_URI"
