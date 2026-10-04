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

## Remote Access
Homelab (`home@100.64.104.52`) and the EC2 proxy (`ec2-user@ec2-proxy`) are reachable over Tailscale with SSH alone (no AWS login needed). Use the AWS CLI (`--profile personal`) only for debugging. See [docs/agent-access.md](docs/agent-access.md) for commands, gotchas, and what needs user approval.

## Testing
No local tests. Changes must be deployed to S3 and verified on actual EC2 instance launch.

## Home Lab (`home-lab-scripts/`)
Scripts for the home lab server, not deployed by CI (workflow ignores this folder).
- Install: clone the repo on the home lab, then `sudo ./home-lab-scripts/<service>/init.sh` (idempotent; re-run after `git pull`)
- Installs scripts to `/usr/local/bin/homelab/<service>/`, units to `/etc/systemd/system/`
- Secrets live in `/etc/homelab/*.env` (created from `*.env.example`), never in the repo
- `common/`: shared `ntfy.sh` helper and `notify-failure@.service`; every service unit should set
  `OnFailure=notify-failure@%n.service` so any failure (exit code, timeout, start failure) alerts via ntfy
- `immich-backup/`: nightly 03:00 rclone sync of Immich UPLOAD_LOCATION (incl. 02:00 DB dumps in `backups/`),
  deleted files kept in dated `--backup-dir` archives