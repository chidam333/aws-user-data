#!/usr/bin/env bash

PROJECT_DIR="/opt/aws-user-data"

# Install Node.js first (required to run load-env.mjs)
dnf install -y nodejs npm

# Load environment variables from SSM Parameter Store via Node.js (single API call)
eval "$(node "$PROJECT_DIR/scripts/load-env.mjs")"

# Add nginx.org repo for njs module (not available in Amazon Linux 2023 default repos)
cat > /etc/yum.repos.d/nginx.repo << 'EOF'
[nginx-stable]
name=nginx stable repo
baseurl=https://nginx.org/packages/centos/9/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
EOF

# Install Nginx with njs module from nginx.org
dnf -y install nginx nginx-module-njs

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
  --expand \
  $CERTBOT_DOMAINS \
  --no-eff-email

# Test auto-renewal and reload nginx after successful renewal
certbot renew --dry-run --deploy-hook "systemctl reload nginx"