#!/bin/bash
# Nightly Immich backup: mirrors UPLOAD_LOCATION to BACKUP_DEST with rclone.
# Any failure just needs a non-zero exit; the unit's OnFailure= sends the alert.
set -euo pipefail

source "$(dirname "$(readlink -f "$0")")/../common/ntfy.sh"

: "${IMMICH_UPLOAD_LOCATION:?not set}"
: "${BACKUP_DEST:?not set}"
: "${BACKUP_ARCHIVE:?not set}"
: "${NTFY_TOPIC:?not set}"
DB_DUMP_MAX_AGE_HOURS=${DB_DUMP_MAX_AGE_HOURS:-26}

LOG_FILE=$(mktemp)
trap 'rm -f "$LOG_FILE"' EXIT

cd "$IMMICH_UPLOAD_LOCATION"

# Immich dumps its database to UPLOAD_LOCATION/backups daily (2:00 AM by default). Photos without
# a recent dump can't be restored into a working Immich, so a missing/stale dump is a failure.
LATEST_DUMP=$(find backups -maxdepth 1 -name 'immich-db-backup-*.sql.gz' -mmin -$((DB_DUMP_MAX_AGE_HOURS * 60)) | sort | tail -n 1)
if [ -z "$LATEST_DUMP" ]; then
    echo "ERROR: no Immich DB dump newer than ${DB_DUMP_MAX_AGE_HOURS}h in $PWD/backups" >&2
    exit 1
fi
echo "Latest DB dump: $LATEST_DUMP"

# Files deleted or overwritten locally are moved into a dated archive folder instead of being removed
# from the backup, so accidental deletions are recoverable.
ARCHIVE_DIR="$BACKUP_ARCHIVE/$(date +%F_%H%M%S)"
echo "Starting Immich backup to $BACKUP_DEST (archive: $ARCHIVE_DIR)"

rclone sync . "$BACKUP_DEST" --backup-dir "$ARCHIVE_DIR" -v --stats 10m 2>&1 | tee "$LOG_FILE"

STATS=$(grep -E "^(Transferred|Deleted|Elapsed time):" "$LOG_FILE" | tr -s " \t" " " | tr "\n" ";" || true)

# A failed success-notification shouldn't mark the backup as failed
ntfy_send "Immich Backup Complete" "white_check_mark,sparkles" "✅ Backup completed. $STATS" \
    || echo "WARN: success notification failed" >&2
