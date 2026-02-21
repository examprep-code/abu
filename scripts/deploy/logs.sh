#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<USAGE
Usage: ./scripts/deploy/logs.sh [lines] [log_file]

Examples:
  ./scripts/deploy/logs.sh
  ./scripts/deploy/logs.sh 500
  ./scripts/deploy/logs.sh 200 /logs/proxy_access_log
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

LINES="${1:-200}"
LOG_FILE="${2:-$REMOTE_LOG_FILE}"

if ! [[ "$LINES" =~ ^[0-9]+$ ]]; then
  die "First argument must be a number of lines"
fi

info "Tailing $LINES lines from $LOG_FILE"
ssh_exec "if [ -f '$LOG_FILE' ]; then tail -n '$LINES' '$LOG_FILE'; else echo 'Log file not found:' '$LOG_FILE'; echo 'Available /logs content:'; ls -la /logs; fi"
