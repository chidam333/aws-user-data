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
PROJECT_REPO_URL="https://github.com/chidam333/aws-user-data.git"
PROJECT_DIR="/opt/aws-user-data"

export CF_API_TOKEN="$(aws ssm get-parameter \
	--name "$CF_API_TOKEN_PARAM_NAME" \
	--with-decryption \
	--query 'Parameter.Value' \
	--output text)"

export CF_ZONE_ID="$(aws ssm get-parameter \
	--name "$CF_ZONE_ID_PARAM_NAME" \
	--with-decryption \
	--query 'Parameter.Value' \
	--output text)"

export CF_RECORD_NAMES="$(aws ssm get-parameter \
	--name "$CF_RECORD_NAMES_PARAM_NAME" \
	--query 'Parameter.Value' \
	--output text)"

export TAILSCALE_AUTH_KEY="$(aws ssm get-parameter \
	--name "$TAILSCALE_AUTH_KEY_PARAM_NAME" \
	--with-decryption \
	--query 'Parameter.Value' \
	--output text)"

# Install NVM and an LTS Node.js runtime.
dnf -y install curl
export NVM_DIR="/root/.nvm"
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
. "$NVM_DIR/nvm.sh"
nvm install --lts
nvm use --lts

# Install Nginx.
dnf -y install nginx

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up --auth-key="$TAILSCALE_AUTH_KEY"

# Install Certbot and Auto-Renewal with nginx reload hook
dnf -y install certbot python3-certbot-nginx
certbot renew --dry-run --deploy-hook "systemctl reload nginx"

# trigger the node scripts
dnf -y install git

# Download the deployment project and run the main setup script from the repo root.
if [ -d "$PROJECT_DIR/.git" ]; then
	git -C "$PROJECT_DIR" pull --ff-only origin main
else
	git clone --depth 1 "$PROJECT_REPO_URL" "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"
node scripts/main.mjs