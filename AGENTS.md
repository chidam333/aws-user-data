# AWS User Data

## Purpose
EC2 bootstrap that installs Node.js, Nginx, Tailscale, Certbot, and updates Cloudflare DNS AAAA records.

## Commands
- `npm start` - Run main Node.js script
- Deploy: push to main branch → GitHub Actions syncs to S3

## Architecture
- `entry.sh` - Fetches from S3, runs user-data.sh
- `user-data.sh` - Main bootstrap (installs deps, runs npm start, certbot)
- `scripts/main.mjs` - Copies nginx config, updates Cloudflare DNS

## Critical Details
- **Cannot run locally** - scripts require AWS EC2 user-data context with:
  - SSM Parameter Store access for secrets (CF_API_TOKEN, CF_ZONE_ID, CF_RECORD_NAMES)
  - Public IPv6 address (fetched from ifconfig.me)
  - AWS CLI and proper IAM role
- **AWS Region:** ap-south-2
- **S3 Bucket:** ec2-user-aws-user-data
- **DNS update runs BEFORE certbot** (required for domain verification)
- **ES modules** - use .mjs extension

## Testing
No local tests. Changes must be deployed to S3 and verified on actual EC2 instance launch.