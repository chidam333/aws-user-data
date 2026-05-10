#!/usr/bin/env bash

# Populate Cloudflare env vars from SSM Parameter Store for scripts/cloudfare.mjs.
CF_API_TOKEN_PARAM_NAME="/ec2-user/cloudfare-api-token"
CF_ZONE_ID_PARAM_NAME="/ec2-user/cloudfare-zone-id"
CF_RECORD_NAMES_PARAM_NAME="/ec2-user/hosted-domains"
TAILSCALE_AUTH_KEY_PARAM_NAME="/ec2-user/tailscale-auth-key"
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

# Scripts updates DNS record in cloudfare, we want to do it before obtaining SSL certificate to ensure certbot can verify domain ownership.
node "$PROJECT_DIR/scripts/main.mjs"

# Convert comma-separated domains to certbot -d flags
DOMAINS=$(echo "$CF_RECORD_NAMES" | tr ',' '\n' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
CERTBOT_DOMAINS=""
for domain in $DOMAINS; do
  CERTBOT_DOMAINS="$CERTBOT_DOMAINS -d $domain"
done

# Obtain SSL certificate
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email chidam.sync@gmail.com \
  --redirect \
  $CERTBOT_DOMAINS \
  --no-eff-email

# Test auto-renewal and reload nginx after successful renewal
certbot renew --dry-run --deploy-hook "systemctl reload nginx"