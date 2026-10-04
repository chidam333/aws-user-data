# Shared ntfy helper, sourced by other homelab scripts.
# Requires NTFY_TOPIC; NTFY_SERVER defaults to https://ntfy.sh.

# Usage: ntfy_send <title> <tags> <message> [priority]
ntfy_send() {
    local title=$1 tags=$2 message=$3 priority=${4:-default}
    curl -fsS --retry 5 --retry-delay 10 --retry-all-errors --max-time 30 \
        -H "Title: $title" -H "Tags: $tags" -H "Priority: $priority" \
        --data-binary "$message" \
        "${NTFY_SERVER:-https://ntfy.sh}/${NTFY_TOPIC:?NTFY_TOPIC not set}" > /dev/null
}
