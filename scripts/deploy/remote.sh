#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<USAGE
Usage: ./scripts/deploy/remote.sh [remote_command]

Without arguments, opens an interactive SSH shell.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

if [[ $# -eq 0 ]]; then
  info "Opening interactive shell on $(ssh_target)"
  ssh_shell
else
  info "Running remote command on $(ssh_target): $*"
  ssh_exec "$*"
fi
