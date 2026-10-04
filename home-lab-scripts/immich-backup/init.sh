#!/bin/bash
# Installs the Immich backup (scripts, systemd units, env files) from a clone of this repo.
# Usage: sudo ./init.sh   (safe to re-run after a git pull)
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: run with sudo" >&2
    exit 1
fi

if ! command -v rclone > /dev/null; then
    echo "ERROR: rclone is not installed" >&2
    exit 1
fi

SRC_DIR=$(dirname "$(readlink -f "$0")")
COMMON_DIR="$SRC_DIR/../common"
BIN_DIR=/usr/local/bin/homelab
ENV_DIR=/etc/homelab

install -d -m 755 "$BIN_DIR/common" "$BIN_DIR/immich-backup"
# notify-failure.sh runs as root, so nothing on its path may be writable by other users
chown -R root:root "$BIN_DIR"
install -m 644 "$COMMON_DIR/ntfy.sh" "$BIN_DIR/common/"
install -m 755 "$COMMON_DIR/notify-failure.sh" "$BIN_DIR/common/"
install -m 755 "$SRC_DIR/backup.sh" "$BIN_DIR/immich-backup/"
install -m 644 "$COMMON_DIR/notify-failure@.service" \
    "$SRC_DIR/immich-backup.service" "$SRC_DIR/immich-backup.timer" /etc/systemd/system/
systemctl daemon-reload

# Env files hold secrets and live outside the repo; they're created from the examples once and never overwritten
install -d -m 700 "$ENV_DIR"
[ -f "$ENV_DIR/ntfy.env" ] || install -m 600 "$COMMON_DIR/ntfy.env.example" "$ENV_DIR/ntfy.env"
[ -f "$ENV_DIR/immich-backup.env" ] || install -m 600 "$SRC_DIR/immich-backup.env.example" "$ENV_DIR/immich-backup.env"

# Usage: require_vars <env file> <var>...
require_vars() {
    local file=$1
    shift
    (
        source "$file"
        for var in "$@"; do
            if [ -z "${!var:-}" ]; then
                echo "ERROR: $var is empty in $file" >&2
                exit 1
            fi
        done
    )
}

if ! require_vars "$ENV_DIR/ntfy.env" NTFY_TOPIC \
    || ! require_vars "$ENV_DIR/immich-backup.env" IMMICH_UPLOAD_LOCATION BACKUP_DEST BACKUP_ARCHIVE; then
    echo "Fill in the env files above, then re-run: sudo $0" >&2
    exit 1
fi

# Prove the alert path works before relying on it
(
    set -a
    source "$ENV_DIR/ntfy.env"
    source "$BIN_DIR/common/ntfy.sh"
    ntfy_send "Immich backup installed on $(hostname)" "gear" "Alerts are working. Next run: 03:00."
)

systemctl enable --now immich-backup.timer
systemctl list-timers immich-backup.timer --no-pager

echo "Installed. To test a run now: sudo systemctl start immich-backup.service && journalctl -u immich-backup -f"
