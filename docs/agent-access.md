# Agent Access: Homelab and AWS Reverse Proxy

How an agent running on the user's laptop can reach the two machines this repo
deals with. Verified working on 2026-10-04.

## Topology

```
internet ──▶ Cloudflare DNS (AAAA) ──▶ EC2 reverse proxy (nginx + certbot)
                                            │  tailnet
                                            ▼
                                   homelab (Immich, Nextcloud, Vaultwarden, ...)
laptop ── tailnet ──▶ both
```

All three devices are on the same Tailscale tailnet (`tailfd0f36.ts.net`), so
MagicDNS short names resolve from the laptop.

| Machine        | Tailnet name | Tailnet IP      | SSH user   | Auth                                  |
|----------------|--------------|-----------------|------------|---------------------------------------|
| Homelab        | `home`       | `100.64.104.52` | `home`     | Default SSH key (host key already trusted) |
| EC2 proxy      | `ec2-proxy`  | `100.84.99.60`* | `ec2-user` | `~/.ssh/chidam-iam-vpc-hyd.pem`       |

\* The EC2 IP is not stable — see [EC2 is disposable](#ec2-is-disposable).

## Homelab

```bash
ssh -o BatchMode=yes home@100.64.104.52 '<command>'
```

- Always pass `-o BatchMode=yes` so a missing key fails fast instead of hanging
  on a password prompt.
- Runs Ubuntu (kernel 6.8). Services run as Docker containers
  (`docker ps` works without sudo): Immich, Nextcloud AIO, Vaultwarden.
- Immich data lives in `/home/home/immich-app/library`.
- Scripts from [`home-lab-scripts/`](../home-lab-scripts) are installed under
  `/usr/local/bin/homelab/` and driven by systemd units
  (e.g. `systemctl list-timers | grep immich`). They are **not** deployed by the
  GitHub Action — copying them to the homelab is a manual step.
- The homelab's `tailscale` CLI is the most reliable way to see the current
  tailnet (including the EC2 node): `ssh home@100.64.104.52 tailscale status`.
  The laptop has the CLI only inside the app bundle:
  `/Applications/Tailscale.app/Contents/MacOS/Tailscale status`.

## EC2 proxy (no AWS login needed)

Day-to-day access is plain SSH over the tailnet. It needs only the key file —
no AWS credentials (verified with all AWS config/credentials disabled).

```bash
ssh -i ~/.ssh/chidam-iam-vpc-hyd.pem -o BatchMode=yes ec2-user@ec2-proxy '<command>'
```

The key is required: there is no Tailscale SSH, so connecting without `-i`
fails with `Permission denied (publickey)`.

The proxy's host key is not pre-trusted, and it changes every time the
instance is replaced. With `BatchMode=yes` an unknown key fails with
`Host key verification failed`. Have the user add it
(`ssh -i ~/.ssh/chidam-iam-vpc-hyd.pem ec2-user@ec2-proxy` once,
interactively), or for a one-off read-only check, add
`-o StrictHostKeyChecking=accept-new`. The new key's fingerprints are printed
in the instance console output (see the AWS debugging table below).

`ec2-user` has passwordless sudo. Useful things to check:

| What                     | Command                                         |
|--------------------------|-------------------------------------------------|
| Bootstrap output         | `sudo cat /var/log/cloud-init-output.log`       |
| Certbot + status email   | `sudo cat /var/log/user-data-postsetup.log`     |
| nginx config valid       | `sudo nginx -t`                                 |
| Deployed repo copy       | `ls /opt/aws-user-data`                         |
| Can it reach the homelab | `curl -sI http://100.64.104.52:2283`            |

The instance is IPv6-only (no public IPv4), a `t4g.nano` running Amazon Linux 2023.
Its security group also allows port 22 from `::/0`, so the same SSH command
works against its public IPv6 address. Prefer the tailnet name, though; the
public address is the fallback if Tailscale failed during bootstrap.

## AWS CLI (debugging)

You don't need AWS access to get a shell. Use it when SSH isn't enough: the
instance won't come up, Tailscale didn't join, or you need to check what was
deployed. Use the `personal` profile for every call. Region is `ap-south-2`
(already the profile default).

```bash
aws --profile personal sts get-caller-identity
```

The instance lives in Auto Scaling group `reverse-proxy-asg` (min = max = 1),
launched from template `lt-0aa2d78cd0bd37189`. Look the instance up by tag
rather than hard-coding its ID:

```bash
aws --profile personal ec2 describe-instances \
  --filters Name=tag:Name,Values=main-reverse-proxy Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].[InstanceId,NetworkInterfaces[0].Ipv6Addresses[0].Ipv6Address]' \
  --output text
```

All of these were verified with the `personal` profile:

| What                                     | Command (prefix `aws --profile personal`) |
|------------------------------------------|-------------------------------------------|
| Instance ID, public IPv6, state          | `ec2 describe-instances ...` (above)      |
| Boot log + SSH host key fingerprints, without SSH | `ec2 get-console-output --instance-id <id> --latest --output text` |
| Why or when the instance was replaced    | `autoscaling describe-scaling-activities --auto-scaling-group-name reverse-proxy-asg --max-items 5` |
| Which secrets exist (names only)         | `ssm get-parameters-by-path --path /ec2-user --query 'Parameters[].Name'` |
| What the next launch will pull           | `s3 ls s3://ec2-user-aws-user-data/`      |

SSM Session Manager is **not** available: the instance doesn't register with SSM
(`aws ssm describe-instance-information` returns nothing) and the laptop has no
`session-manager-plugin`. Use SSH.

## EC2 is disposable

- Any change made by hand on the instance is lost when the ASG replaces it.
  Real changes go through this repo: push to `main` → GitHub Action syncs to
  `s3://ec2-user-aws-user-data` → the next launch picks it up via `entry.sh`.
- Pushing to `main` does **not** update the running instance. To apply a change,
  either re-sync and re-run on the box, or replace the instance
  (`aws autoscaling start-instance-refresh --auto-scaling-group-name reverse-proxy-asg`).
  Both cause downtime for proxied sites — ask the user first.
- A replacement instance joins the tailnet as a new node. Its tailnet IP will
  differ, its SSH host key will differ (expect a host-key mismatch for
  `ec2-proxy` in `~/.ssh/known_hosts`), and if the old node hasn't been removed
  from the tailnet the new one may be named `ec2-proxy-1`. Check
  `tailscale status` on the homelab to find it.

## Ground rules for agents

- Read-only commands (status, logs, `nginx -t`, `docker ps`, `describe-*`) are
  fine to run freely.
- Writes are fine too: editing files, installing scripts/units, and
  `systemctl` start/stop/enable on either host.
- On the homelab, `home` does **not** have passwordless sudo, so anything needing
  root (writing `/etc`, `/usr/local`, `systemctl` on system units) has to be run
  by the user. Hand them the exact command.
- Still ask the user first for anything that takes proxied sites down or is
  hard to undo: restarting containers or nginx, instance refreshes, writing to
  SSM or S3, or touching Cloudflare DNS.
- Never print secret values. SSM parameters under `/ec2-user/*` hold the
  Cloudflare token, Tailscale OAuth secret, and Resend token — if you need to
  confirm one exists, query it without `--with-decryption`.
- The homelab holds the only primary copy of personal photos and passwords
  (Immich, Vaultwarden). Never delete anything under `/home/home/immich-app` or
  in Docker volumes.
