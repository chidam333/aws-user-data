#!/usr/bin/env bash

# Send all script output to a log file for troubleshooting.
exec > /var/log/user-data.log 2>&1

# AWS cli is needed for ssm parameter store access
dnf -y install awscli

# Populate Cloudflare env vars from SSM Parameter Store for scripts/cloudfare.mjs.
CF_API_TOKEN_PARAM_NAME="/ec2-user/cloudfare-api-token"
CF_ZONE_ID_PARAM_NAME="/ec2-user/cloudfare-zone-id"
CF_RECORD_NAMES_PARAM_NAME="/ec2-user/hosted-domains"
TAILSCALE_AUTH_KEY_PARAM_NAME="/ec2-user/tailscale-auth-key"
PROJECT_S3_BUCKET="s3://ec2-user-aws-user-data"
PROJECT_DIR="/opt/aws-user-data"

export CF_API_TOKEN="$(aws ssm get-parameter \
	--name "$CF_API_TOKEN_PARAM_NAME" \
	--region ap-south-2 \
	--endpoint-url https://ssm.ap-south-2.api.aws \
	--with-decryption \
	--query 'Parameter.Value' \
	--output text)"

export CF_ZONE_ID="$(aws ssm get-parameter \
	--name "$CF_ZONE_ID_PARAM_NAME" \
	--region ap-south-2 \
	--endpoint-url https://ssm.ap-south-2.api.aws \
	--with-decryption \
	--query 'Parameter.Value' \
	--output text)"

export CF_RECORD_NAMES="$(aws ssm get-parameter \
	--name "$CF_RECORD_NAMES_PARAM_NAME" \
	--region ap-south-2 \
	--endpoint-url https://ssm.ap-south-2.api.aws \
	--query 'Parameter.Value' \
	--output text)"

export TAILSCALE_AUTH_KEY="$(aws ssm get-parameter \
	--name "$TAILSCALE_AUTH_KEY_PARAM_NAME" \
	--region ap-south-2 \
	--endpoint-url https://ssm.ap-south-2.api.aws \
	--with-decryption \
	--query 'Parameter.Value' \
	--output text)"

# Install latest Node from dnf
dnf install -y nodejs npm

# Install Nginx.
dnf -y install nginx

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up --auth-key="$TAILSCALE_AUTH_KEY"

# Install Certbot and Auto-Renewal with nginx reload hook
dnf -y install certbot python3-certbot-nginx
certbot renew --dry-run --deploy-hook "systemctl reload nginx"

# Download the scripts from s3 and execute the main script.
aws s3 sync "$PROJECT_S3_BUCKET" "$PROJECT_DIR" --delete --region ap-south-2 --endpoint-url https://s3.dualstack.ap-south-2.amazonaws.com
node "$PROJECT_DIR/scripts/main.mjs"