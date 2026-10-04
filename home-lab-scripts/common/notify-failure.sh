#!/bin/bash
# Sends an ntfy alert with the journal of a failed systemd unit.
# Triggered by OnFailure=notify-failure@%n.service, so it fires on any failure:
# non-zero exit, timeout, crash/kill, or the unit failing to start (e.g. missing env file).
set -uo pipefail

source "$(dirname "$(readlink -f "$0")")/ntfy.sh"

UNIT="$1"
INVOCATION=$(systemctl show -p InvocationID --value "$UNIT")

if [ -n "$INVOCATION" ]; then
    LOGS=$(journalctl "_SYSTEMD_INVOCATION_ID=$INVOCATION" -o cat --no-pager | tail -n 20)
else
    LOGS=$(journalctl -u "$UNIT" -n 20 -o cat --no-pager)
fi

# ntfy truncates messages over 4KB
ntfy_send "$UNIT FAILED on $(hostname)" "x,fire" \
    "❌ $(systemctl show -p Result --value "$UNIT")
$(echo "$LOGS" | tail -c 3500)" high
